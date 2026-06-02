// utils/resumehandler.js

/**
 * ResumeParser
 * Parses raw text from resumes and organizes it into structured JSON
 * with all the sections you listed.
 */
export default class ResumeParser {
  constructor(rawText) {
    this.rawText = rawText;
  }

  async extractSections() {
    const lines = this.rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);

    // Initialize all sections
    const sections = {
      contact: {
        name: "",
        email: "",
        phone: "",
        location: "",
        linkedin: "",
        website: ""
      },
      profile_summary: "",
      skills: [],
      capabilities: [],
      experience: [],
      onsite_assignments: [],
      work_history: [],
      education: [],
      certifications: [],
      achievements: [],
      publications: [],
      patents: [],
      notable_engagements: [],
      affiliations: [],
      languages: [],
      conferences: [],
      volunteering: [],
      interests: []
    };

    // Regex for common patterns
    const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
    const phoneRegex = /\+?\d[\d\s.-]{7,}\d/;
    const linkedinRegex = /https?:\/\/(www\.)?linkedin\.com\/[^\s]+/i;
    const websiteRegex = /https?:\/\/(www\.)?[^\s]+/i;

    let currentSection = null;
    let profileLines = [];

    for (const line of lines) {
      const lower = line.toLowerCase();

      // Detect sections by keywords
      if (lower.includes('education')) currentSection = 'education';
      else if (lower.includes('experience') || lower.includes('work history')) currentSection = 'experience';
      else if (lower.includes('skills')) currentSection = 'skills';
      else if (lower.includes('certifications')) currentSection = 'certifications';
      else if (lower.includes('achievements')) currentSection = 'achievements';
      else if (lower.includes('publications')) currentSection = 'publications';
      else if (lower.includes('patents')) currentSection = 'patents';
      else if (lower.includes('languages')) currentSection = 'languages';
      else if (lower.includes('volunteering')) currentSection = 'volunteering';
      else if (lower.includes('conferences')) currentSection = 'conferences';
      else if (lower.includes('affiliations')) currentSection = 'affiliations';
      else if (lower.includes('interests')) currentSection = 'interests';
      else currentSection = null;

      // Extract contact info
      if (!sections.contact.email && emailRegex.test(line)) sections.contact.email = line.match(emailRegex)[0];
      if (!sections.contact.phone && phoneRegex.test(line)) sections.contact.phone = line.match(phoneRegex)[0];
      if (!sections.contact.linkedin && linkedinRegex.test(line)) sections.contact.linkedin = line.match(linkedinRegex)[0];
      if (!sections.contact.website && websiteRegex.test(line)) sections.contact.website = line.match(websiteRegex)[0];

      // Assume first line without email/phone as name
      if (!sections.contact.name && line.split(' ').length <= 4 && !emailRegex.test(line) && !phoneRegex.test(line)) {
        sections.contact.name = line;
        continue;
      }

      // Collect profile summary until the first section keyword
      if (!currentSection && sections.profile_summary === "" && !emailRegex.test(line) && !phoneRegex.test(line)) {
        profileLines.push(line);
      }

      // Add line to the detected section
      if (currentSection) {
        if (Array.isArray(sections[currentSection])) sections[currentSection].push(line);
      }
    }

    sections.profile_summary = profileLines.join(' ');

    // Clean up empty arrays
    for (const key in sections) {
      if (Array.isArray(sections[key]) && sections[key].length === 0) sections[key] = [];
      if (typeof sections[key] === 'string') sections[key] = sections[key].trim();
    }

    return sections;
  }
}