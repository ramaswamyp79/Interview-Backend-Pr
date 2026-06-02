import axios from "axios";

export const convertToPdf = async (buffer) => {
  const jobRes = await axios.post(
    "https://api.cloudconvert.com/v2/jobs",
    {
      tasks: {
        "import-1": {
          operation: "import/base64",
          file: buffer.toString("base64"),
          filename: "resume.docx",
        },
        "convert-1": {
          operation: "convert",
          input: "import-1",
          output_format: "pdf",
        },
        "export-1": {
          operation: "export/url",
          input: "convert-1",
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.CLOUDCONVERT_API_KEY}`,
      },
    }
  );

  const jobId = jobRes.data.data.id;

  // 🔥 WAIT for job completion
  let job;
  while (true) {
    const statusRes = await axios.get(
      `https://api.cloudconvert.com/v2/jobs/${jobId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLOUDCONVERT_API_KEY}`,
        },
      }
    );

    job = statusRes.data.data;

    if (job.status === "finished") break;
    if (job.status === "error") {
      throw new Error("CloudConvert job failed");
    }

    await new Promise((r) => setTimeout(r, 1000)); // wait 1 sec
  }

  const exportTask = job.tasks.find((t) => t.name === "export-1");
  const fileUrl = exportTask.result.files[0].url;

  const pdfRes = await axios.get(fileUrl, {
    responseType: "arraybuffer",
  });

  return Buffer.from(pdfRes.data);
};