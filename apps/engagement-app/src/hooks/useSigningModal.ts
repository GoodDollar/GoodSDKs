import { useState } from "react";
import { useToast } from "./use-toast";

export function useSigningModal() {
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const { toast } = useToast();

  const wrapWithSigningModal = async <T>(
    fn: () => Promise<T>,
    successMessage?: string,
  ): Promise<T | undefined> => {
    try {
      setIsSigningModalOpen(true);
      const result = await fn();
      setIsSigningModalOpen(false);
      if (successMessage) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }
      return result;
    } catch (error) {
      setIsSigningModalOpen(false);
      toast({
        title: "Error",
        description: `Transaction failed: ${(error as Error).message}`,
        variant: "destructive",
      });
    }
  };

  return {
    isSigningModalOpen,
    setIsSigningModalOpen, // Add this to expose the setter
    wrapWithSigningModal,
  };
}
