import { extractRequirements, mergeRequirementDelta } from "./requirementExtractor.js";

const REQUIREMENT_SEQUENCE = [
  {
    field: "dimensions",
    label: "dimensions",
    question:
      "What dimensions should I use? A format like 120 x 80 x 30 mm works well, or give diameter/height for round parts."
  },
  {
    field: "shapeType",
    label: "shape type",
    question:
      "What is the primary shape or object type? For example: box, cylinder, bracket, gear, vase, building, or sculpture."
  },
  {
    field: "useCase",
    label: "use case",
    question:
      "What is the intended use case: mechanical, artistic, architecture, product prototype, or something else?"
  },
  {
    field: "material",
    label: "material",
    question:
      "What material should I assume? Examples: PLA, resin, aluminum, steel, wood, concrete, or ceramic."
  },
  {
    field: "detailLevel",
    label: "level of detail",
    question:
      "What level of detail do you want: low, medium, or high?"
  },
  {
    field: "constraints",
    label: "constraints",
    question:
      "Any manufacturing or 3D printing constraints, such as wall thickness, overhang limits, watertight mesh, tolerances, or support minimization? You can also say none."
  }
];

export async function processConversationTurn(session, userText) {
  const delta = await extractRequirements(userText, session.requirements);
  session.requirements = mergeRequirementDelta(session.requirements, delta);
  updateSessionTitle(session);

  if (session.awaitingConfirmation) {
    return handleConfirmationTurn(session, userText);
  }

  if (hasGenerationTrigger(userText)) {
    const missing = getMissingRequirements(session.requirements);
    if (missing.length > 0) {
      const next = missing[0];
      return {
        assistantMessage:
          `I am not ready to generate yet because the ${next.label} is still missing.\n\n${next.question}`,
        action: null
      };
    }

    session.awaitingConfirmation = true;
    return {
      assistantMessage:
        `${formatRequirementSummary(session.requirements)}\n\nIf this is correct, reply exactly with "Confirm and generate". If you want changes, describe them and I will update the spec first.`,
      action: null
    };
  }

  const missing = getMissingRequirements(session.requirements);
  if (missing.length > 0) {
    return {
      assistantMessage: missing[0].question,
      action: null
    };
  }

  return {
    assistantMessage:
      `${formatRequirementSummary(session.requirements)}\n\nI have enough information to prepare the model. Say "Generate the model" when you want me to summarize for final confirmation.`,
    action: null
  };
}

function handleConfirmationTurn(session, userText) {
  if (hasConfirmAndGenerateIntent(userText)) {
    session.awaitingConfirmation = false;
    return {
      assistantMessage:
        "Confirmed. I am starting the model generation job now, then I will repair the mesh and prepare preview/export files.",
      action: {
        type: "generate",
        requirements: session.requirements
      }
    };
  }

  if (hasNegativeIntent(userText)) {
    session.awaitingConfirmation = false;
    return {
      assistantMessage:
        "No problem. Tell me what should change, and I will update the requirements before generation.",
      action: null
    };
  }

  const missing = getMissingRequirements(session.requirements);
  if (missing.length > 0) {
    session.awaitingConfirmation = false;
    return {
      assistantMessage: missing[0].question,
      action: null
    };
  }

  session.awaitingConfirmation = true;
  return {
    assistantMessage:
      `${formatRequirementSummary(session.requirements)}\n\nI still need an explicit generation confirmation before I start. Reply with "Confirm and generate" to proceed.`,
    action: null
  };
}

export function getMissingRequirements(requirements) {
  return REQUIREMENT_SEQUENCE.filter(({ field }) => {
    const value = requirements[field];
    if (field === "constraints") return value === null || value === undefined;
    if (field === "dimensions") return !hasUsableDimensions(value);
    return value === null || value === undefined || value === "";
  });
}

function hasUsableDimensions(dimensions) {
  if (!dimensions || typeof dimensions !== "object") return false;
  const hasRectangular = dimensions.length && dimensions.width;
  const hasRound = dimensions.diameter || dimensions.radius;
  return Boolean(hasRectangular || hasRound || dimensions.notes);
}

export function formatRequirementSummary(requirements) {
  const dimensions = requirements.dimensions || {};
  const dimensionText = formatDimensions(dimensions);
  const constraints =
    Array.isArray(requirements.constraints) && requirements.constraints.length
      ? requirements.constraints.join(", ")
      : "None specified";
  const notes = requirements.notes?.length ? `\n- Notes: ${requirements.notes.join("; ")}` : "";

  return [
    "Here is the model specification I have collected:",
    `- Dimensions: ${dimensionText}`,
    `- Shape type: ${requirements.shapeType || "Not specified"}`,
    `- Use case: ${requirements.useCase || "Not specified"}`,
    `- Material: ${requirements.material || "Not specified"}`,
    `- Level of detail: ${requirements.detailLevel || "Not specified"}`,
    `- Constraints: ${constraints}`,
    `- Finish: ${requirements.finish || "Default"}`,
    `- Tolerance: ${requirements.tolerance || "Default"}${notes}`
  ].join("\n");
}

function formatDimensions(dimensions) {
  if (!dimensions || Object.keys(dimensions).length === 0) return "Not specified";
  const unit = dimensions.unit || "mm";
  const rectangular = [dimensions.length, dimensions.width, dimensions.height]
    .filter((value) => value !== null && value !== undefined)
    .join(" x ");
  const round = [
    dimensions.diameter ? `diameter ${dimensions.diameter}` : null,
    dimensions.radius ? `radius ${dimensions.radius}` : null,
    dimensions.height ? `height ${dimensions.height}` : null
  ]
    .filter(Boolean)
    .join(", ");
  const notes = dimensions.notes ? ` (${dimensions.notes})` : "";
  return `${rectangular || round || "custom"} ${unit}${notes}`.trim();
}

function hasGenerationTrigger(text) {
  return /\b(generate|create|build)\s+(the\s+)?(3d\s+)?model\b/i.test(text) ||
    /\bstart\s+generation\b/i.test(text);
}

function hasConfirmAndGenerateIntent(text) {
  return /\bconfirm\s+(and\s+)?generate\b/i.test(text) ||
    /\byes,?\s+generate\b/i.test(text) ||
    /\bgenerate\s+it\b/i.test(text) ||
    /\bproceed\s+with\s+generation\b/i.test(text);
}

function hasNegativeIntent(text) {
  return /\b(no|cancel|stop|not yet|change|revise)\b/i.test(text);
}

function updateSessionTitle(session) {
  if (session.title && session.title !== "Untitled 3D model") return;
  const shape = session.requirements.shapeType;
  const useCase = session.requirements.useCase;
  if (shape && useCase) {
    session.title = `${capitalize(useCase)} ${shape}`;
  } else if (shape) {
    session.title = `${capitalize(shape)} model`;
  }
}

function capitalize(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
