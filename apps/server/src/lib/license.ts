import type { License } from "@artei/shared";

const PD_RE = /publicdomain|\/zero\/|\/mark\//i;
const CC_RE = /creativecommons\.org\/licenses\/([a-z-]+)\/(\d(?:\.\d)?)/i;

/** Turn a Creative Commons deed URL into a structured License. */
export function parseLicenseUrl(raw: string | undefined | null): License {
  const url = (raw ?? "").trim().replace(/^http:\/\//i, "https://");
  if (url && PD_RE.test(url)) {
    return {
      name: /\/zero\//i.test(url) ? "CC0 1.0 (Public Domain)" : "Public Domain",
      url,
      attribution: false,
      nonCommercial: false,
      noDerivatives: false,
      shareAlike: false,
    };
  }
  const m = CC_RE.exec(url);
  if (!m) {
    // Unknown license: be conservative and treat it as the most restrictive CC license.
    return {
      name: "License unknown — see source",
      url: url || "https://creativecommons.org/licenses/",
      attribution: true,
      nonCommercial: true,
      noDerivatives: true,
      shareAlike: false,
    };
  }
  const parts = m[1]!.toLowerCase().split("-");
  const version = m[2]!;
  return {
    name: `CC ${parts.map((p) => p.toUpperCase()).join("-")} ${version}`,
    url,
    attribution: parts.includes("by"),
    nonCommercial: parts.includes("nc"),
    noDerivatives: parts.includes("nd"),
    shareAlike: parts.includes("sa"),
  };
}
