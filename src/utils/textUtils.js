import fs from "fs";
import mammoth from "mammoth";
import AdmZip from "adm-zip";
import xml2js from "xml2js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const textUtils = {

  /* ================= DOCX ================= */
  async extractTextFromDocx(filePath) {
    try {
      const zip = new AdmZip(filePath);

      // 1️⃣ Extract visible text using mammoth
      const result = await mammoth.extractRawText({ path: filePath });
      let fullText = result.value;

      // 2️⃣ Extract hyperlinks manually from rels file
      let extractedLinks = [];

      const relsEntry = zip.getEntry("word/_rels/document.xml.rels");

      if (relsEntry) {
        const relsXml = relsEntry.getData().toString("utf8");
        const parser = new xml2js.Parser();
        const parsed = await parser.parseStringPromise(relsXml);

        const relationships = parsed.Relationships?.Relationship || [];

        relationships.forEach(rel => {
          if (rel.$.Target && rel.$.Target.startsWith("http")) {
            extractedLinks.push(rel.$.Target);
          }
        });
      }

      // 3️⃣ Append links so Gemini can see them
      if (extractedLinks.length > 0) {
        fullText += "\n\n" + extractedLinks.join("\n");
      }

      return this.preprocessResumeText(fullText);

    } catch (err) {
      console.error("DOCX extraction error:", err);
      throw err;
    }
  },

  /* ================= PPTX ================= */
  async extractTextFromPptx(filePath) {
    try {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      const parser = new xml2js.Parser();
      let text = "";

      for (const entry of entries) {
        if (
          entry.entryName.startsWith("ppt/slides/slide") &&
          entry.entryName.endsWith(".xml")
        ) {
          const xml = zip.readAsText(entry);
          const parsed = await parser.parseStringPromise(xml);

          const shapes =
            parsed?.["p:sld"]?.["p:cSld"]?.[0]?.["p:sp"] || [];

          for (const shape of shapes) {
            const paragraphs =
              shape?.["p:txBody"]?.[0]?.["a:p"] || [];

            for (const para of paragraphs) {
              const runs = para?.["a:r"] || [];

              for (const run of runs) {
                if (run?.["a:t"]?.[0]) {
                  text += run["a:t"][0] + " ";
                }
              }
              text += "\n";
            }
          }
        }
      }

      return this.preprocessResumeText(text);

    } catch (err) {
      console.error("PPTX extraction error:", err);
      throw err;
    }
  },
  /* ================= PDF ================= */
  async extractTextFromPdf(filePath) {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    let fullText = "";
    let extractedLinks = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);

      /* ---------- TEXT EXTRACTION WITH LINE DETECTION ---------- */
      const textContent = await page.getTextContent();

      const lines = [];
      let currentLine = "";
      let lastY = null;

      for (const item of textContent.items) {
        const y = item.transform[5]; // vertical position

        // If Y changes significantly → new line
        if (lastY !== null && Math.abs(y - lastY) > 5) {
          lines.push(currentLine.trim());
          currentLine = "";
        }

        currentLine += item.str + " ";
        lastY = y;
      }

      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }

      fullText += lines.join("\n") + "\n";

      /* ---------- HYPERLINK EXTRACTION ---------- */
      const annotations = await page.getAnnotations();

      annotations.forEach(a => {
        if (a.url) {
          extractedLinks.push(a.url);
        }
      });
    }

    /* ---------- APPEND LINKS TO TOP FOR LLM ---------- */
    if (extractedLinks.length > 0) {
      // Remove duplicates
      extractedLinks = [...new Set(extractedLinks)];

      fullText =
        extractedLinks.join("\n") +
        "\n\n" +
        fullText;
    }

    /* ---------- CLEAN MAILTO IF PRESENT ---------- */
    fullText = fullText.replace(/mailto:/gi, "");
    fullText = fullText.replace(/\/;$/gm, "");

    return this.preprocessResumeText(fullText);
  },

  /* ================= ROUTER ================= */
  async extractText(filePath) {
    const ext = filePath.split(".").pop().toLowerCase();

    if (ext === "pdf") return this.extractTextFromPdf(filePath);
    if (ext === "docx") return this.extractTextFromDocx(filePath);
    if (ext === "pptx") return this.extractTextFromPptx(filePath);

    throw new Error("Unsupported file type: " + ext);
  },

  /* ================= CLEANING ================= */
  preprocessResumeText(text) {
    if (!text) return "";

    let cleaned = text
      .replace(/\r\n/g, "\n")
      .replace(/\t/g, " ")
      .replace(/[ ]{2,}/g, " ")
      .replace(/â€“/g, "–")
      .replace(/â€”/g, "—")
      .replace(/â€¢/g, "•")
      .replace(/\s*•\s*/g, "\n• ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = cleaned.match(urlRegex) || [];

    if (urls.length > 0) {
      cleaned = cleaned.replace(urlRegex, "");
      cleaned = urls.join("\n") + "\n\n" + cleaned;
    }

    return cleaned.trim();
  }
};

export default textUtils;