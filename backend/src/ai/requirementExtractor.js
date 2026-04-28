import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";
import { requirementExtractionPrompt } from "./prompts.js";

const SHAPE_ALIASES = [
  "box",
  "cube",
  "cylinder",
  "sphere",
  "cone",
  "torus",
  "gear",
  "bracket",
  "flange",
  "plate",
  "building",
  "arch",
  "vase",
  "statue",
  "character"
];

const MATERIAL_ALIASES = [
  "pla",
  "abs",
  "petg",
  "resin",
  "nylon",
  "steel",
  "aluminum",
  "aluminium",
  "brass",
  "wood",
  "concrete",
  "ceramic"
];

let geminiClient = null;
let geminiUnavailableUntil = 0;

function getGeminiClient() {
  if (!config.gemini.apiKey) return null;
  if (Date.now() < geminiUnavailableUntil) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return geminiClient;
}

export async function extractRequirements(message, currentRequirements) {
  const llmResult = await extractWithGemini(message, currentRequirements);
  const heuristicResult = extractHeuristically(message);

  return mergeRequirementDelta(heuristicResult, llmResult || {});
}

async function extractWithGemini(message, currentRequirements) {
  const client = getGeminiClient();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: config.gemini.model,
      contents: JSON.stringify({
        currentRequirements,
        latestUserMessage: message
      }),
      config: {
        systemInstruction: requirementExtractionPrompt,
        responseMimeType: "application/json",
        temperature: 0,
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    });

    const content = response.text;
    if (!content) return null;
    return JSON.parse(content);
  } catch (error) {
    geminiUnavailableUntil = Date.now() + 60_000;
    console.warn("Gemini requirement extraction failed; using heuristic fallback.", error.message);
    return null;
  }
}

function extractHeuristically(message) {
  const text = message.toLowerCase();
  const delta = {
    dimensions: null,
    shapeType: null,
    useCase: null,
    material: null,
    detailLevel: null,
    constraints: null,
    finish: null,
    tolerance: null,
    notes: []
  };

  const dimensionMatch = message.match(
    /(\d+(?:\.\d+)?)\s*(?:x|by|\*)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|by|\*)\s*(\d+(?:\.\d+)?))?\s*(mm|cm|m|in|inch|inches)?/i
  );
  if (dimensionMatch) {
    delta.dimensions = {
      length: Number(dimensionMatch[1]),
      width: Number(dimensionMatch[2]),
      height: dimensionMatch[3] ? Number(dimensionMatch[3]) : null,
      diameter: null,
      radius: null,
      unit: normalizeUnit(dimensionMatch[4]) || "mm",
      notes: null
    };
  }

  const diameterMatch = message.match(/(?:diameter|dia)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)?/i);
  const radiusMatch = message.match(/radius\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)?/i);
  const heightMatch = message.match(/height\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)?/i);

  if (diameterMatch || radiusMatch || heightMatch) {
    delta.dimensions = {
      ...(delta.dimensions || {}),
      length: delta.dimensions?.length ?? null,
      width: delta.dimensions?.width ?? null,
      height: heightMatch ? Number(heightMatch[1]) : delta.dimensions?.height ?? null,
      diameter: diameterMatch ? Number(diameterMatch[1]) : null,
      radius: radiusMatch ? Number(radiusMatch[1]) : null,
      unit:
        normalizeUnit(diameterMatch?.[2]) ||
        normalizeUnit(radiusMatch?.[2]) ||
        normalizeUnit(heightMatch?.[2]) ||
        delta.dimensions?.unit ||
        "mm",
      notes: delta.dimensions?.notes ?? null
    };
  }

  const shape = SHAPE_ALIASES.find((candidate) => text.includes(candidate));
  if (shape) delta.shapeType = shape;

  const material = MATERIAL_ALIASES.find((candidate) => text.includes(candidate));
  if (material) delta.material = material === "aluminium" ? "aluminum" : material;

  if (text.includes("mechanical")) delta.useCase = "mechanical";
  if (text.includes("architecture") || text.includes("architectural")) delta.useCase = "architecture";
  if (text.includes("artistic") || text.includes("sculpture") || text.includes("art ")) delta.useCase = "artistic";
  if (text.includes("prototype")) delta.useCase = "prototype";
  if (text.includes("3d print") || text.includes("3d-print")) delta.useCase = delta.useCase || "3D printing";

  if (/\blow detail\b|\bsimple\b/.test(text)) delta.detailLevel = "low";
  if (/\bmedium detail\b|\bmoderate\b/.test(text)) delta.detailLevel = "medium";
  if (/\bhigh detail\b|\bdetailed\b|\bfine detail\b/.test(text)) delta.detailLevel = "high";

  if (/\bno constraints?\b|\bnone\b|\bno special constraints?\b/.test(text)) {
    delta.constraints = [];
  } else {
    const constraints = [];
    if (text.includes("3d print") || text.includes("3d-print")) constraints.push("3D printable");
    if (text.includes("support")) constraints.push("Minimize support material");
    if (text.includes("overhang")) constraints.push("Respect overhang limits");
    if (text.includes("wall thickness")) constraints.push("Maintain wall thickness");
    if (text.includes("non-manifold")) constraints.push("Avoid non-manifold geometry");
    if (text.includes("watertight")) constraints.push("Watertight mesh");
    if (constraints.length) delta.constraints = constraints;
  }

  const toleranceMatch = message.match(/tolerance\s*(?:of)?\s*([+\-/.\d\s]*(?:mm|cm|m|in|inch|inches)?)/i);
  if (toleranceMatch?.[1]?.trim()) delta.tolerance = toleranceMatch[1].trim();

  if (text.includes("smooth")) delta.finish = "smooth";
  if (text.includes("matte")) delta.finish = "matte";
  if (text.includes("polished")) delta.finish = "polished";

  return delta;
}

export function mergeRequirementDelta(base, incoming) {
  const result = structuredClone(base || {});
  const source = incoming || {};

  for (const [key, value] of Object.entries(source)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0 && key !== "constraints") continue;
    if (key === "dimensions" && value && typeof value === "object") {
      result.dimensions = { ...(result.dimensions || {}), ...removeEmptyValues(value) };
      continue;
    }
    if (key === "notes" && Array.isArray(value)) {
      result.notes = [...new Set([...(result.notes || []), ...value.filter(Boolean)])];
      continue;
    }
    result[key] = value;
  }

  return result;
}

function removeEmptyValues(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
}

function normalizeUnit(unit) {
  if (!unit) return null;
  const normalized = unit.toLowerCase();
  if (normalized === "inch" || normalized === "inches") return "in";
  return normalized;
}
