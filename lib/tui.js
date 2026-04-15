"use strict";

/**
 * TUI wrapper around @clack/prompts. Kept thin so the rest of the code can
 * operate without a terminal (tests, non-TTY, --cli flag path).
 *
 * Exposes `renderSelector(detections) -> { selectedIds, cancelled }`.
 * `detections` is an array of `{ adapter, detection }` as produced by
 * `lib/adapters/index.js::detectAll()`.
 */

let clack;
try {
  // eslint-disable-next-line global-require
  clack = require("@clack/prompts");
} catch (_err) {
  clack = null;
}

function isCancelSymbol(val) {
  // @clack returns a Symbol when the user cancels via Ctrl+C
  return typeof val === "symbol" || (clack && clack.isCancel && clack.isCancel(val));
}

async function renderSelector(detections) {
  if (!clack) {
    throw new Error(
      "@clack/prompts is not installed. Run `npm install` first or use --cli/--non-interactive.",
    );
  }

  clack.intro("claude-notifications · install hooks");

  const options = detections.map(({ adapter, detection }) => {
    const hint = [];
    if (!detection.installed) hint.push("not detected");
    if (detection.installed && !adapter.supportsHooks) {
      hint.push(adapter.unsupportedReason || "unsupported");
    }
    return {
      value: adapter.id,
      label: adapter.label,
      hint: hint.join(" · "),
      // clack has no native "disabled" concept — we express it by filtering
      // these out of the selectable set below.
    };
  });

  // Only selectable rows are ones that are installed AND supportsHooks.
  const selectableIds = new Set(
    detections
      .filter(({ adapter, detection }) => detection.installed && adapter.supportsHooks)
      .map(({ adapter }) => adapter.id),
  );

  if (selectableIds.size === 0) {
    clack.note(
      detections
        .map(({ adapter, detection }) => {
          const mark = detection.installed ? "✓" : "·";
          const note = detection.installed
            ? adapter.supportsHooks
              ? "ready"
              : adapter.unsupportedReason || "unsupported"
            : "not detected";
          return `${mark} ${adapter.label.padEnd(24)} ${note}`;
        })
        .join("\n"),
      "Detected CLIs",
    );
    clack.outro("Nothing to install. Exiting.");
    return { selectedIds: [], cancelled: false };
  }

  const defaults = detections
    .filter(({ adapter, detection }) => detection.installed && adapter.supportsHooks)
    .map(({ adapter }) => adapter.id);

  const visibleOptions = options.filter((opt) => {
    const d = detections.find(({ adapter }) => adapter.id === opt.value);
    return d && d.detection.installed;
  });

  // Append unsupported-but-detected with a hint so users see why they aren't selectable.
  const selectableOptions = visibleOptions.filter((opt) => selectableIds.has(opt.value));
  const unsupportedLines = visibleOptions
    .filter((opt) => !selectableIds.has(opt.value))
    .map((opt) => `  · ${opt.label} (${opt.hint || "unsupported"})`);

  if (unsupportedLines.length > 0) {
    clack.note(unsupportedLines.join("\n"), "Detected but unsupported");
  }

  const result = await clack.multiselect({
    message: "Install notification hooks into:",
    options: selectableOptions,
    initialValues: defaults,
    required: false,
  });

  if (isCancelSymbol(result)) {
    clack.cancel("Cancelled.");
    return { selectedIds: [], cancelled: true };
  }

  clack.outro(
    result.length === 0
      ? "Nothing selected. Exiting."
      : `Selected: ${result.join(", ")}`,
  );

  return { selectedIds: result, cancelled: false };
}

module.exports = { renderSelector };
