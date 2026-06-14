"use client";

import { IconPhoto, IconTrash } from "@tabler/icons-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import {
  REPORT_IMAGE_ALLOWED_MIME_TYPES,
  REPORT_IMAGE_MAX_BYTES,
  REPORT_IMAGE_MAX_COUNT,
} from "@/lib/reports/constants";
import { reportImageMetadataSchema } from "@/lib/reports/validation";

export type SelectedReportImage = {
  id: string;
  file: File;
  previewUrl: string;
  altText: string;
};

type ImagePickerProps = {
  images: SelectedReportImage[];
  onChange: (images: SelectedReportImage[]) => void;
  itemName: string;
};

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

export function ImagePicker({ images, onChange, itemName }: ImagePickerProps) {
  const [error, setError] = useState("");
  const previewUrls = useRef(new Set<string>());
  const remainingSlots = REPORT_IMAGE_MAX_COUNT - images.length;

  useEffect(() => {
    const urls = previewUrls.current;

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  function discardPendingPreviews(pendingImages: SelectedReportImage[]) {
    pendingImages.forEach((image) => {
      URL.revokeObjectURL(image.previewUrl);
      previewUrls.current.delete(image.previewUrl);
    });
  }

  function addFiles(fileList: FileList | null) {
    setError("");

    if (!fileList) {
      return;
    }

    const incoming = Array.from(fileList);

    if (incoming.length > remainingSlots) {
      setError(`Maksimal ${REPORT_IMAGE_MAX_COUNT} gambar. Tersisa ${remainingSlots} slot.`);
      return;
    }

    const nextImages: SelectedReportImage[] = [];

    for (const file of incoming) {
      const validation = reportImageMetadataSchema.safeParse({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      if (!validation.success) {
        discardPendingPreviews(nextImages);
        setError(validation.error.issues[0]?.message ?? "File gambar tidak valid.");
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      nextImages.push({
        id: crypto.randomUUID(),
        file,
        previewUrl,
        altText: "",
      });
    }

    onChange([...images, ...nextImages]);
  }

  function removeImage(id: string) {
    const image = images.find((item) => item.id === id);

    if (image) {
      URL.revokeObjectURL(image.previewUrl);
      previewUrls.current.delete(image.previewUrl);
    }

    onChange(images.filter((item) => item.id !== id));
  }

  function updateAltText(id: string, altText: string) {
    onChange(images.map((image) => (image.id === id ? { ...image, altText } : image)));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-md border border-dashed bg-surface p-4">
        <label
          htmlFor="report_images"
          className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md bg-muted/50 px-4 py-5 text-center text-sm text-muted-foreground transition-colors hover:bg-muted"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
        >
          <IconPhoto className="mb-2 h-6 w-6 text-primary" aria-hidden="true" />
          <span className="font-heading font-semibold text-foreground">Pilih atau tarik gambar</span>
          <span>JPEG, PNG, WebP. Maksimal {formatFileSize(REPORT_IMAGE_MAX_BYTES)} per gambar.</span>
        </label>
        <input
          id="report_images"
          type="file"
          accept={REPORT_IMAGE_ALLOWED_MIME_TYPES.join(",")}
          multiple
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.currentTarget.value = "";
          }}
          disabled={remainingSlots === 0}
        />
        <p className="text-xs text-muted-foreground">{remainingSlots} slot gambar tersisa.</p>
      </div>

      {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}

      {images.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <div key={image.id} className="rounded-md border bg-surface p-3">
              {/* Future LNFTI-27 AI suggestions can prefill editable alt text here. */}
              <Image
                src={image.previewUrl}
                alt={image.altText || `Pratinjau foto ${itemName || "barang"} ${index + 1}`}
                width={320}
                height={240}
                unoptimized
                className="aspect-[4/3] w-full rounded-md object-cover"
              />
              <div className="mt-3 space-y-2">
                <label htmlFor={`image_alt_${image.id}`} className="font-heading text-xs font-semibold">
                  Alt text opsional
                </label>
                <input
                  id={`image_alt_${image.id}`}
                  type="text"
                  value={image.altText}
                  maxLength={160}
                  onChange={(event) => updateAltText(image.id, event.target.value)}
                  placeholder={`Foto ${itemName || "barang"} ${index + 1}`}
                  className="h-10 w-full rounded-md border bg-surface px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-semibold text-primary hover:bg-muted"
                >
                  <IconTrash className="h-4 w-4" aria-hidden="true" />
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
