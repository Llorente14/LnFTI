import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

function transpile(path) {
  return ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function loadModule(path, customRequire = require) {
  const moduleRecord = { exports: {} };
  const evaluateModule = new Function("exports", "module", "require", transpile(path));
  evaluateModule(moduleRecord.exports, moduleRecord, customRequire);
  return moduleRecord.exports;
}

const constants = loadModule("src/lib/reports/constants.ts");
const env = loadModule("src/lib/env.ts");
const schemas = loadModule("src/lib/ai/schemas.ts", (specifier) => {
  if (specifier === "@/lib/reports/constants") {
    return constants;
  }
  return require(specifier);
});
const suggestions = loadModule("src/lib/ai/report-suggestions.ts", (specifier) => {
  if (specifier === "@/lib/ai/schemas") {
    return schemas;
  }
  return require(specifier);
});

const validEnv = {
  aiServiceUrl: "https://ai.example.com",
  aiInternalApiToken: "x".repeat(32),
  aiRequestTimeoutMs: "120000",
};

test("AI service URL accepts HTTPS", () => {
  const parsed = env.validateAiServiceEnv(validEnv);
  assert.equal(parsed.aiServiceUrl, "https://ai.example.com");
});

test("local HTTP AI URL is accepted", () => {
  const parsed = env.validateAiServiceEnv({
    ...validEnv,
    aiServiceUrl: "http://127.0.0.1:8000/",
  });
  assert.equal(parsed.aiServiceUrl, "http://127.0.0.1:8000");
});

test("non-local HTTP AI URL is rejected", () => {
  assert.throws(
    () => env.validateAiServiceEnv({ ...validEnv, aiServiceUrl: "http://ai.example.com" }),
    /http only/,
  );
});

test("short and example internal tokens are rejected", () => {
  assert.throws(
    () => env.validateAiServiceEnv({ ...validEnv, aiInternalApiToken: "short" }),
    /at least 32/,
  );
  assert.throws(
    () => env.validateAiServiceEnv({
      ...validEnv,
      aiInternalApiToken: "replace_with_at_least_32_random_characters",
    }),
    /generated secret/,
  );
});

test("AI timeout rejects partial numeric strings", () => {
  assert.throws(
    () => env.validateAiServiceEnv({ ...validEnv, aiRequestTimeoutMs: "120000ms" }),
    /integer/,
  );
});

test("AI env remains server-only outside public env", () => {
  const source = readFileSync("src/lib/env.ts", "utf8");
  const getPublicEnvBody = source.match(/export function getPublicEnv\(\)[\s\S]*?^}/m)?.[0] ?? "";
  assert.doesNotMatch(source, /NEXT_PUBLIC_AI/);
  assert.doesNotMatch(getPublicEnvBody, /AI_INTERNAL_API_TOKEN/);
});

test("valid YOLO upstream payload is normalized", () => {
  const normalized = schemas.normalizeYoloResponse({
    suggested_category: "Elektronik",
    detections: [
      { label: "laptop", confidence: 0.9341 },
      { label: "mouse", confidence: 0.81 },
    ],
    inference_ms: 72.41,
  });
  assert.equal(normalized.suggestedCategory, "Elektronik");
  assert.deepEqual(normalized.detections.map((detection) => detection.label), ["laptop", "mouse"]);
});

test("valid OCR upstream payload is normalized", () => {
  const normalized = schemas.normalizeOcrResponse({
    lines: [{ text: "ASUS", confidence: 0.9612 }],
    full_text: "ASUS",
    average_confidence: 0.9612,
    inference_ms: 136.8,
    truncated: false,
  });
  assert.equal(normalized.fullText, "ASUS");
  assert.equal(normalized.averageConfidence, 0.9612);
});

test("OCR average confidence matches browser-visible lines", () => {
  const normalized = schemas.normalizeOcrResponse({
    lines: Array.from({ length: 11 }, (_, index) => ({
      text: `line-${index}`,
      confidence: index === 10 ? 0 : 1,
    })),
    full_text: Array.from({ length: 11 }, (_, index) => `line-${index}`).join("\n"),
    average_confidence: 0.9091,
    inference_ms: 10,
    truncated: false,
  });
  assert.equal(normalized.lines.length, 10);
  assert.equal(normalized.averageConfidence, 1);
  assert.equal(normalized.truncated, true);
});

test("invalid category is discarded", () => {
  const normalized = schemas.normalizeYoloResponse({
    suggested_category: "Unknown category",
    detections: [{ label: "laptop", confidence: 0.9341 }],
    inference_ms: 72.41,
  });
  assert.equal(normalized.suggestedCategory, null);
});

test("partial detection-only result is supported", () => {
  const parsed = schemas.aiAnalysisResultSchema.parse({
    status: "partial",
    detection: {
      suggestedCategory: "Elektronik",
      detections: [{ label: "laptop", confidence: 0.93 }],
      inferenceMs: 72.41,
    },
    ocr: null,
    warnings: ["OCR_UNAVAILABLE"],
  });
  assert.equal(parsed.status, "partial");
  assert.equal(parsed.ocr, null);
});

test("OCR append helper preserves existing private text and prevents duplicates", () => {
  const first = suggestions.appendOcrToPrivateCharacteristics("Ada stiker merah.", "LOGITECH\nM331");
  assert.equal(first.status, "success");
  assert.match(first.value, /Ada stiker merah\.\n\nTeks terlihat pada foto:\nLOGITECH\nM331/);
  const second = suggestions.appendOcrToPrivateCharacteristics(first.value, "LOGITECH\nM331");
  assert.equal(second.status, "duplicate");
  assert.equal(second.value, first.value);
});

test("OCR append helper respects private field limit", () => {
  const result = suggestions.appendOcrToPrivateCharacteristics("x".repeat(990), "LOGITECH");
  assert.equal(result.status, "too_long");
  assert.equal(result.value.length, 990);
});

test("detected labels are formatted for users", () => {
  assert.equal(suggestions.formatDetectedLabel("mouse"), "Mouse");
  assert.equal(suggestions.formatDetectedLabel("wireless_mouse"), "Wireless Mouse");
  assert.equal(suggestions.formatDetectedLabel("USB-C  CABLE"), "Usb C Cable");
});

test("browser client uses same-origin proxy and generic contract failure", () => {
  const source = readFileSync("src/lib/ai/analyze-image.ts", "utf8");
  assert.match(source, /\/api\/ai\/analyze-image/);
  assert.match(source, /safeParse/);
  assert.doesNotMatch(source, /AI_SERVICE_URL/);
  assert.doesNotMatch(source, /AI_INTERNAL_API_TOKEN/);
});

test("form cancels analysis on submit and partial UI stays manual", () => {
  const form = readFileSync("src/app/report/new/report-form.tsx", "utf8");
  const picker = readFileSync("src/components/reports/image-picker.tsx", "utf8");
  assert.match(form, /activeAnalysis\.current\?\.controller\.abort\(\)/);
  assert.match(form, /isAnalysisBusy=\{Boolean\(activeAnalysisId\) \|\| isSubmitting\}/);
  assert.match(picker, /Sebagian analisis tidak tersedia/);
  assert.match(picker, /Tambahkan ke ciri privat/);
});

test("report photo help auto-fills without overwriting manual edits", () => {
  const form = readFileSync("src/app/report/new/report-form.tsx", "utf8");

  assert.match(form, /applyAnalysisToForm/);
  assert.match(form, /topDetectedLabel\(result\)/);
  assert.match(form, /formatDetectedLabel\(itemName\)/);
  assert.match(form, /manualAutofillOverridesRef\.current\.itemName/);
  assert.match(form, /manualAutofillOverridesRef\.current\.category/);
});

test("photo result UI hides model scores and processing time", () => {
  const form = readFileSync("src/app/report/new/report-form.tsx", "utf8");
  const picker = readFileSync("src/components/reports/image-picker.tsx", "utf8");

  assert.doesNotMatch(picker, /formatPercent/);
  assert.doesNotMatch(picker, /confidence\}/);
  assert.doesNotMatch(picker, /inferenceMs\.toFixed/);
  assert.doesNotMatch(picker, /Gunakan kategori/);
  assert.doesNotMatch(form, /Analisis AI gagal/);
  assert.doesNotMatch(form, /Kategori diperbarui dari saran AI/);
});
