import { describe, expect, it } from "vitest";
import { uploadFilesSequentially } from "@/lib/uploadClient";

function makeFile(name: string) {
  return new File([`content-${name}`], name, { type: "text/plain" });
}

describe("uploadFilesSequentially", () => {
  it("collects uploaded docs for all successful files", async () => {
    const files = [makeFile("a.txt"), makeFile("b.txt"), makeFile("c.txt")];

    const result = await uploadFilesSequentially(files, async (file) => ({
      ok: true,
      documents: [
        {
          id: `id-${file.name}`,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          status: "READY",
          chunkCount: 1
        }
      ]
    }));

    expect(result.uploadedDocs).toHaveLength(3);
    expect(result.uploadedDocs.map((doc) => doc.filename)).toEqual(["a.txt", "b.txt", "c.txt"]);
    expect(result.failedFiles).toEqual([]);
  });

  it("tracks failed files without dropping successful uploads", async () => {
    const files = [makeFile("a.txt"), makeFile("b.txt"), makeFile("c.txt")];

    const result = await uploadFilesSequentially(files, async (file) => {
      if (file.name === "b.txt") {
        return { ok: false, documents: [] };
      }

      return {
        ok: true,
        documents: [
          {
            id: `id-${file.name}`,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            status: "READY",
            chunkCount: 1
          }
        ]
      };
    });

    expect(result.uploadedDocs).toHaveLength(2);
    expect(result.uploadedDocs.map((doc) => doc.filename)).toEqual(["a.txt", "c.txt"]);
    expect(result.failedFiles).toEqual(["b.txt"]);
  });

  it("times out a hanging file upload and continues remaining files", async () => {
    const files = [makeFile("a.txt"), makeFile("b.txt"), makeFile("c.txt")];

    const result = await uploadFilesSequentially(
      files,
      async (file) => {
        if (file.name === "b.txt") {
          return new Promise(() => {
            // intentionally never resolves
          });
        }

        return {
          ok: true,
          documents: [
            {
              id: `id-${file.name}`,
              filename: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              status: "READY",
              chunkCount: 1
            }
          ]
        };
      },
      { timeoutMs: 10 }
    );

    expect(result.uploadedDocs).toHaveLength(2);
    expect(result.uploadedDocs.map((doc) => doc.filename)).toEqual(["a.txt", "c.txt"]);
    expect(result.failedFiles).toEqual(["b.txt"]);
  });
});
