import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SigningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SigningModal({ open, onOpenChange }: SigningModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Transaction</DialogTitle>
          <DialogDescription>
            Please sign the transaction in your wallet to continue.
            This signature is required to complete the transaction.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
