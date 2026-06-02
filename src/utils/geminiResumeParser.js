import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const CANONICAL_PROMPT = `CANONICAL RESUME EXTRACTION PROMPT (UNIVERSAL)

You are an expert AI resume analyzer specialized in transforming resumes
of ANY format into a normalized ATS-compatible canonical JSON
representation suitable for AI retrieval, interview systems, and talent search.

The resume may have arbitrary structure, missing sections, merged sections,
reordered content, or non-standard headings. Classify information based on
semantic meaning, NOT section titles.

Return ONLY valid JSON in this EXACT schema:

{
  "contact": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "website": "",
    "github": ""
  },
  "profile_summary": "",
  "skills": [],
  "capabilities": [],

  "experience": [
    {
      "company": "",
      "title": "",
      "start_date": "",
      "end_date": "",
      "location": "",
      "description": [],
      "technologies": [],
      "links": []
    }
  ],

  "projects": [
    {
      "title": "",
      "type": "",
      "start_date": "",
      "end_date": "",
      "description": [],
      "technologies": [],
      "links": []
    }
  ],

  "onsite_assignments": [],
  "work_history": [],
  "education": [],
  "certifications": [],
  "achievements": [],
  "publications": [],
  "patents": [],
  "notable_engagements": [],
  "affiliations": [],
  "languages": [],
  "conferences": [],
  "volunteering": [],
  "interests": [],
  "links_registry": []
}

GLOBAL RULES

1. Use semantic meaning, not headings.
2. Do NOT hallucinate or invent missing information.
3. Do NOT omit relevant information.
4. If a field is missing → return empty string "" or empty array [].
5. Do not duplicate content across sections.
6. Merge scattered content belonging to the same employer or project.
7. Each employer must appear only once in "experience".
8. Output strictly valid JSON only.

HYPERLINK RULES

• Preserve EVERY URL found in the resume.
• Route links by meaning:
  - LinkedIn → contact.linkedin
  - GitHub → contact.github
  - Portfolio / personal website → contact.website
  - Project demo URLs → inside respective project.links
  - Company URLs → inside respective experience.links
• Maintain a deduplicated complete list of ALL URLs in "links_registry".
• No URL should be lost, omitted, or left floating in text.

SECTION CLASSIFICATION

CONTACT → Identity & contact details.
PROFILE_SUMMARY → Career overview paragraph.
SKILLS → Flat list of tools, technologies, platforms, domains.
CAPABILITIES → Cross-role strengths not tied to one employer.

EXPERIENCE → Official employment engagements.
Each experience object must include:
company, title, start_date, end_date, description (array), technologies (array), links (array).

PROJECTS → Personal, academic, freelance, hackathon, or self-built work.
Each project must include:
title, description (array), technologies (array), links (array).
Projects must NOT be placed inside experience unless tied to formal employment.

ONSITE_ASSIGNMENTS → Overseas/onsite deployments.
WORK_HISTORY → Employment timeline only.
EDUCATION → Academic qualifications.
CERTIFICATIONS → Professional credentials.
ACHIEVEMENTS → Awards or measurable recognitions.
PUBLICATIONS → Articles, papers, books.
PATENTS → Intellectual property or inventions.
NOTABLE_ENGAGEMENTS → Consulting, workshops, presales.
AFFILIATIONS → Professional memberships.
LANGUAGES → Spoken languages.
CONFERENCES → Conference participation.
VOLUNTEERING → Non-profit or mentoring work.
INTERESTS → Optional personal interests.

INPUT

RESUME:
{{RESUME_TEXT}}`;

export async function parseResumeWithGemini(resumeText) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: CANONICAL_PROMPT.replace("{{RESUME_TEXT}}", resumeText) }],
        },
      ],
    });

    let text = response.text.trim();

    // 🔹 Remove markdown wrappers
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // 🔹 Extract only JSON between first { and last }
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("No valid JSON found in Gemini response");
    }

    let jsonString = text.substring(firstBrace, lastBrace + 1);

    // 🔹 Fix smart quotes
    jsonString = jsonString
      .replace(/“|”/g, '"')
      .replace(/‘|’/g, "'");

    // 🔹 Remove trailing commas (VERY IMPORTANT FIX)
    jsonString = jsonString.replace(/,\s*}/g, "}");
    jsonString = jsonString.replace(/,\s*]/g, "]");

    try {
      return JSON.parse(jsonString);
    } catch (parseErr) {
      console.error("❌ JSON Parse Failed. Raw JSON:");
      console.error(jsonString);
      return null; // don't crash upload
    }

  } catch (error) {
    console.error("Gemini Error:", error.message);
    throw error;
  }
}