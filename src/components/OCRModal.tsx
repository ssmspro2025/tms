import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface OCRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (extractedText: string) => void;
}

export default function OCRModal({ open, onOpenChange, onSave }: OCRModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setExtractedText("");
    }
  };

  const extractTextFromImage = async (imageFile: File) => {
    const result = await Tesseract.recognize(imageFile, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          setProgress(Math.round(m.progress * 100));
        }
      },
    });
    return result.data.text;
  };

  const extractTextFromPDF = async (pdfFile: File) => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      setProgress(Math.round((i / pdf.numPages) * 100));
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({
          canvasContext: context,
          viewport: viewport,
        } as any).promise;
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), "image/png");
        });
        const imageFile = new File([blob], `page-${i}.png`, { type: "image/png" });
        const pageText = await extractTextFromImage(imageFile);
        fullText += `\n--- Page ${i} ---\n${pageText}`;
      }
    }

    return fullText;
  };

  const handleExtract = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setIsExtracting(true);
    setProgress(0);

    try {
      let text = "";
      const fileType = file.type;

      if (fileType === "application/pdf") {
        text = await extractTextFromPDF(file);
      } else if (fileType.startsWith("image/")) {
        text = await extractTextFromImage(file);
      } else {
        toast.error("Unsupported file type");
        setIsExtracting(false);
        return;
      }

      setExtractedText(text);
      toast.success("Text extracted successfully");
    } catch (error) {
      console.error("OCR Error:", error);
      toast.error("Failed to extract text");
    } finally {
      setIsExtracting(false);
      setProgress(0);
    }
  };

  const handleSave = () => {
    if (!extractedText.trim()) {
      toast.error("No text to save");
      return;
    }
    onSave(extractedText);
    setExtractedText("");
    setFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Test Paper & Extract Text</DialogTitle>
          <DialogDescription>
            Upload a PDF or image file to extract text using OCR.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Upload File (PDF, JPG, PNG)</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
            />
            {file && (
              <p className="text-sm text-muted-foreground mt-1">
                Selected: {file.name}
              </p>
            )}
          </div>

          <Button
            onClick={handleExtract}
            disabled={!file || isExtracting}
            className="w-full"
          >
            {isExtracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting... {progress}%
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Extract Text
              </>
            )}
          </Button>

          {extractedText && (
            <>
              <div>
                <Label>Extracted Text (Editable)</Label>
                <Textarea
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>

              <Button onClick={handleSave} className="w-full">
                Save Extracted Text
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}