export const requirementExtractionPrompt = `
You extract requirements for a 3D model generation system.
Return only valid JSON. Do not include markdown.

Schema:
{
  "dimensions": null or {
    "length": number|null,
    "width": number|null,
    "height": number|null,
    "diameter": number|null,
    "radius": number|null,
    "unit": "mm"|"cm"|"m"|"in"|null,
    "notes": string|null
  },
  "shapeType": string|null,
  "useCase": string|null,
  "material": string|null,
  "detailLevel": "low"|"medium"|"high"|null,
  "constraints": array of strings|null,
  "finish": string|null,
  "tolerance": string|null,
  "notes": array of strings
}

Rules:
- Only include values that are stated or strongly implied in the latest user message.
- If the user says no constraints, set constraints to [].
- Preserve units if stated.
- Keep short natural-language notes when exact dimensions or constraints are ambiguous.
`;
