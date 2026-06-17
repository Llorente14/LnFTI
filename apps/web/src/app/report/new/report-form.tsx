"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import {
  cleanupDraftReportAction,
  createDraftReportAction,
  finalizeReportSubmissionAction,
  type ReportImageFinalizeInput,
} from "@/app/report/new/actions";
import {
  ImagePicker,
  type ImageAnalysisState,
  type SelectedReportImage,
} from "@/components/reports/image-picker";
import { Button } from "@/components/ui/button";
import { analyzeReportImage } from "@/lib/ai/analyze-image";
import { appendOcrToPrivateCharacteristics, formatDetectedLabel, topDetectedLabel } from "@/lib/ai/report-suggestions";
import type { AiAnalysisResult } from "@/lib/ai/schemas";
import { REPORT_CATEGORIES, REPORT_IMAGE_BUCKET, REPORT_TYPES } from "@/lib/reports/constants";
import { buildReportImagePath } from "@/lib/reports/image-path";
import {
  formatDatetimeLocal,
  reportFormSchema,
  validateReportImageMetadata,
  type ReportFormValues,
} from "@/lib/reports/validation";
import { createClient } from "@/lib/supabase/client";

type FieldErrors = Partial<Record<keyof ReportFormValues | "images", string>>;
type AutofillField = "itemName" | "category";
type ManualAutofillOverrides = Record<AutofillField, boolean>;

const baseInitialValues: Omit<ReportFormValues, "reportType"> = {
  itemName: "",
  category: "Lainnya",
  publicDescription: "",
  privateCharacteristics: null,
  campus: "Kampus 1",
  building: "Gedung R",
  locationDetail: "Area FTI",
  eventAt: formatDatetimeLocal(new Date()),
};

function fieldError(errors: FieldErrors, name: keyof FieldErrors) {
  return errors[name] ? <p className="text-sm font-medium text-primary">{errors[name]}</p> : null;
}

export function ReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedType = searchParams.get("type")?.toUpperCase();
  const [values, setValues] = useState<ReportFormValues>(() => ({
    ...baseInitialValues,
    reportType: requestedType === "FOUND" ? "FOUND" : "LOST",
  }));
  const [images, setImages] = useState<SelectedReportImage[]>([]);
  const [analysisStates, setAnalysisStates] = useState<Record<string, ImageAnalysisState>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [manualAutofillOverrides, setManualAutofillOverrides] = useState<ManualAutofillOverrides>({
    itemName: false,
    category: false,
  });
  const activeAnalysis = useRef<{ imageId: string; controller: AbortController } | null>(null);
  const imagesRef = useRef(images);
  const manualAutofillOverridesRef = useRef(manualAutofillOverrides);

  const maxEventAt = useMemo(() => formatDatetimeLocal(new Date()), []);

  function updateValue<Key extends keyof ReportFormValues>(key: Key, value: ReportFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === "itemName" || key === "category") {
      setManualAutofillOverrides((current) => ({ ...current, [key]: true }));
    }
  }

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    manualAutofillOverridesRef.current = manualAutofillOverrides;
  }, [manualAutofillOverrides]);

  useEffect(() => () => {
    activeAnalysis.current?.controller.abort();
  }, []);

  function applyAnalysisToForm(result: AiAnalysisResult) {
    const itemName = topDetectedLabel(result);
    const category = result.detection?.suggestedCategory ?? null;
    const nextValues: Partial<ReportFormValues> = {};
    const applied: string[] = [];

    if (itemName && !manualAutofillOverridesRef.current.itemName) {
      nextValues.itemName = formatDetectedLabel(itemName);
      applied.push("nama barang");
    }

    if (category && !manualAutofillOverridesRef.current.category) {
      nextValues.category = category;
      applied.push("kategori");
    }

    if (Object.keys(nextValues).length === 0) {
      setAiFeedback("Hasil foto tersedia. Form tidak diubah karena isian sudah Anda sesuaikan.");
      return;
    }

    setValues((current) => ({ ...current, ...nextValues }));
    setAiFeedback(`${applied.join(" dan ")} diperbarui dari foto. Anda tetap bisa mengubahnya.`);
  }

  function handleImagesChange(nextImages: SelectedReportImage[]) {
    const imageIds = new Set(nextImages.map((image) => image.id));

    setImages(nextImages);
    setAnalysisStates((current) =>
      Object.fromEntries(Object.entries(current).filter(([imageId]) => imageIds.has(imageId))),
    );

    if (activeAnalysis.current && !imageIds.has(activeAnalysis.current.imageId)) {
      activeAnalysis.current.controller.abort();
      activeAnalysis.current = null;
      setActiveAnalysisId(null);
    }
  }

  async function handleAnalyzeImage(image: SelectedReportImage) {
    if (activeAnalysis.current || isSubmitting) {
      return;
    }

    const controller = new AbortController();
    activeAnalysis.current = { imageId: image.id, controller };
    setActiveAnalysisId(image.id);
    setAiFeedback("");
    setAnalysisStates((current) => ({ ...current, [image.id]: { status: "loading" } }));

    try {
      const result = await analyzeReportImage(image.file, controller.signal);
      if (!imagesRef.current.some((item) => item.id === image.id)) {
        return;
      }
      setAnalysisStates((current) => ({ ...current, [image.id]: { status: "success", result } }));
      applyAnalysisToForm(result);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const errorMessage = error instanceof Error
        ? error.message
        : "Bantuan foto gagal. Data laporan Anda belum berubah.";
      setAnalysisStates((current) => ({ ...current, [image.id]: { status: "error", message: errorMessage } }));
    } finally {
      if (activeAnalysis.current?.imageId === image.id) {
        activeAnalysis.current = null;
        setActiveAnalysisId(null);
      }
    }
  }

  function appendOcrText(fullText: string) {
    const result = appendOcrToPrivateCharacteristics(values.privateCharacteristics, fullText);
    if (result.status === "too_long") {
      setAiFeedback("Teks dari foto tidak muat di ciri privat. Salin bagian yang perlu secara manual.");
      return;
    }
    if (result.status === "duplicate") {
      setAiFeedback("Teks terlihat sudah ada di ciri privat.");
      return;
    }
    updateValue("privateCharacteristics", result.value);
    setAiFeedback("Teks terlihat ditambahkan ke ciri privat. Periksa sebelum kirim.");
  }

  async function removeUploadedObjects(paths: string[]) {
    if (paths.length === 0) {
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.storage.from(REPORT_IMAGE_BUCKET).remove(paths);
    if (error && process.env.NODE_ENV !== "production") {
      console.warn("Report image cleanup failed.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    activeAnalysis.current?.controller.abort();
    activeAnalysis.current = null;
    setActiveAnalysisId(null);
    setErrors({});
    setMessage("");
    setIsSubmitting(true);

    let reportId: string | null = null;
    const uploadedPaths: string[] = [];

    try {
      const parsed = reportFormSchema.safeParse(values);
      const imageMetadata = images.map((image) => ({
        name: image.file.name,
        size: image.file.size,
        type: image.file.type,
        altText: image.altText,
      }));

      if (!parsed.success) {
        setErrors(
          parsed.error.issues.reduce<FieldErrors>((accumulator, issue) => {
            const field = issue.path[0] as keyof FieldErrors | undefined;
            if (field) {
              accumulator[field] = issue.message;
            }
            return accumulator;
          }, {}),
        );
        return;
      }

      try {
        validateReportImageMetadata(imageMetadata);
      } catch (error) {
        setErrors({ images: error instanceof Error ? error.message : "Gambar tidak valid." });
        return;
      }

      const eventAtIso = new Date(parsed.data.eventAt).toISOString();
      const draft = await createDraftReportAction({ ...parsed.data, eventAt: eventAtIso });
      if (draft.status === "error") {
        setMessage(draft.message);
        return;
      }

      reportId = draft.reportId;
      const supabase = createClient();
      const metadata: ReportImageFinalizeInput[] = [];

      for (const [index, image] of images.entries()) {
        const storagePath = buildReportImagePath({ reportId: draft.reportId, mimeType: image.file.type });
        const { error } = await supabase.storage.from(REPORT_IMAGE_BUCKET).upload(storagePath, image.file, {
          cacheControl: "3600",
          contentType: image.file.type,
          upsert: false,
        });
        if (error) {
          throw new Error("upload_failed");
        }
        uploadedPaths.push(storagePath);
        metadata.push({
          storagePath,
          altText: image.altText.trim() || `Foto ${draft.itemName} ${index + 1}`,
          sortOrder: index + 1,
        });
      }

      const finalized = await finalizeReportSubmissionAction(draft.reportId, metadata);
      if (finalized.status === "error") {
        throw new Error("finalize_failed");
      }
      router.push("/me/reports?created=1");
    } catch {
      await removeUploadedObjects(uploadedPaths);
      if (reportId) {
        await cleanupDraftReportAction(reportId);
      }
      setMessage("Laporan gagal dikirim. Tidak ada laporan sukses dibuat. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {message ? (
        <p className="rounded-md border border-primary/30 bg-[var(--crimson-pale-2)] px-3 py-2 text-sm text-primary">
          {message}
        </p>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="font-heading text-sm font-bold">Jenis laporan</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {REPORT_TYPES.map((type) => (
            <label
              key={type}
              className={`flex min-h-12 cursor-pointer items-center justify-between rounded-md border px-4 py-3 text-sm font-semibold transition-colors ${values.reportType === type ? "border-primary bg-[var(--crimson-pale-2)] text-primary" : "bg-surface hover:bg-muted"}`}
            >
              <span>{type === "LOST" ? "Barang hilang" : "Barang temuan"}</span>
              <input type="radio" name="reportType" value={type} checked={values.reportType === type} onChange={() => updateValue("reportType", type)} className="h-4 w-4 accent-primary" />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="itemName" className="font-heading text-sm font-semibold">Nama barang</label>
          <input id="itemName" value={values.itemName} onChange={(event) => updateValue("itemName", event.target.value)} minLength={3} maxLength={100} required className="h-11 w-full rounded-md border bg-surface px-3 text-sm" placeholder="Dompet hitam" />
          {fieldError(errors, "itemName")}
        </div>
        <div className="space-y-2">
          <label htmlFor="category" className="font-heading text-sm font-semibold">Kategori</label>
          <select id="category" value={values.category} onChange={(event) => updateValue("category", event.target.value as ReportFormValues["category"])} required className="h-11 w-full rounded-md border bg-surface px-3 text-sm">
            {REPORT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          {fieldError(errors, "category")}
        </div>
        <div className="space-y-2">
          <label htmlFor="eventAt" className="font-heading text-sm font-semibold">Waktu kejadian</label>
          <input id="eventAt" type="datetime-local" value={values.eventAt} max={maxEventAt} onChange={(event) => updateValue("eventAt", event.target.value)} required className="h-11 w-full rounded-md border bg-surface px-3 text-sm" />
          {fieldError(errors, "eventAt")}
        </div>
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="publicDescription" className="font-heading text-sm font-semibold">Deskripsi publik</label>
          <textarea id="publicDescription" value={values.publicDescription} onChange={(event) => updateValue("publicDescription", event.target.value)} minLength={20} maxLength={1000} required rows={4} className="w-full rounded-md border bg-surface px-3 py-2 text-sm" placeholder="Tuliskan ciri umum yang aman untuk dilihat semua orang." />
          {fieldError(errors, "publicDescription")}
        </div>
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="privateCharacteristics" className="font-heading text-sm font-semibold">Ciri privat kepemilikan</label>
          <textarea id="privateCharacteristics" value={values.privateCharacteristics ?? ""} onChange={(event) => updateValue("privateCharacteristics", event.target.value)} maxLength={1000} rows={3} className="w-full rounded-md border bg-surface px-3 py-2 text-sm" placeholder="Contoh: inisial, isi dompet, label pribadi. Bagian ini tidak tampil di halaman publik." />
          <p className="text-xs text-muted-foreground">Informasi ini hanya untuk verifikasi. Jangan ditampilkan sebagai preview publik.</p>
          {fieldError(errors, "privateCharacteristics")}
        </div>
        <div className="space-y-2">
          <label htmlFor="campus" className="font-heading text-sm font-semibold">Kampus</label>
          <input id="campus" value={values.campus ?? ""} onChange={(event) => updateValue("campus", event.target.value)} maxLength={120} className="h-11 w-full rounded-md border bg-surface px-3 text-sm" placeholder="Kampus 1" />
        </div>
        <div className="space-y-2">
          <label htmlFor="building" className="font-heading text-sm font-semibold">Gedung</label>
          <input id="building" value={values.building} onChange={(event) => updateValue("building", event.target.value)} required maxLength={120} className="h-11 w-full rounded-md border bg-surface px-3 text-sm" placeholder="Gedung R" />
          {fieldError(errors, "building")}
        </div>
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="locationDetail" className="font-heading text-sm font-semibold">Detail lokasi</label>
          <input id="locationDetail" value={values.locationDetail ?? ""} onChange={(event) => updateValue("locationDetail", event.target.value)} maxLength={300} className="h-11 w-full rounded-md border bg-surface px-3 text-sm" placeholder="Dekat lift lantai 3" />
          {fieldError(errors, "locationDetail")}
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-lg font-bold">Foto opsional</h2>
          <p className="text-sm text-muted-foreground">Tambahkan hingga tiga foto. Foto hanya dipakai untuk membantu verifikasi laporan.</p>
        </div>
        <ImagePicker images={images} onChange={handleImagesChange} itemName={values.itemName} analysisStates={analysisStates} isAnalysisBusy={Boolean(activeAnalysisId) || isSubmitting} currentCategory={values.category} onAnalyze={handleAnalyzeImage} onAppendOcr={appendOcrText} />
        {aiFeedback ? <p className="text-sm font-medium text-primary">{aiFeedback}</p> : null}
        {fieldError(errors, "images")}
      </section>

      <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Setelah dikirim, laporan masuk antrean review.</p>
        <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-44">{isSubmitting ? "Mengirim..." : "Kirim laporan"}</Button>
      </div>
    </form>
  );
}
