import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import FileUploadStatus from "./FileUploadStatus";
import InvoiceItemDetails from "./InvoiceItemDetails";

interface InvoicePopupProps {
  open: boolean;
  onClose: () => void;
}

export default function InvoicePopup({ open, onClose }: InvoicePopupProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-charcoal">Invoice Upload</h2>
          <p className="mt-1 text-sm text-warm-gray">
            Upload your invoice to automatically parse items into inventory. Review and
            confirm the details before adding.
          </p>
        </div>

        {/* File upload entries */}
        <div className="flex flex-col gap-2">
          <FileUploadStatus
            filename="Invoice_691.pdf"
            size="20 MB / 20 MB"
            status="completed"
          />
          <FileUploadStatus
            filename="Invoice_692.pdf"
            size="15 MB / 20 MB"
            status="uploading"
            progress={75}
          />
        </div>

        {/* Item Details table */}
        <InvoiceItemDetails />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onClose}>
            Add to Inventory
          </Button>
        </div>
      </div>
    </Modal>
  );
}
