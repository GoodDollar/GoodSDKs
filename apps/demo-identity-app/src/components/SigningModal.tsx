import React from "react";
import { Dialog, Text, YStack, Spinner } from "tamagui";

interface SigningModalProps {
  open: boolean;
  onClose: () => void;
}

export const SigningModal: React.FC<SigningModalProps> = ({
  open,
  onClose,
}) => {
  return (
    <Dialog modal open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          animation="quick"
          o={0.5}
          enterStyle={{ o: 0 }}
          exitStyle={{ o: 0 }}
        />
        <Dialog.Content
          bordered
          elevate
          key="content"
          animation={[
            "quick",
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          x={0}
          scale={1}
          opacity={1}
          y={0}
        >
          <YStack alignItems="center" space>
            <Spinner size="large" color="$primary" />
            <Text color="$text" fontSize="$medium" mt="$small">
              Please sign the transaction in your wallet to continue.
            </Text>
          </YStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
