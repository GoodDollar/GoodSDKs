import React, { useEffect, useState } from "react";
import { useEngagementRewards } from "@goodsdks/engagement-sdk";
import { useParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useSigningModal } from "@/hooks/useSigningModal";
import { SigningModal } from "./SigningModal";

import env from "@/env";
import { TruncatedAddress } from "./ui/TruncatedAddress";

interface AppDetails {
  owner: string;
  rewardReceiver: string;
  userAndInviterPercentage: number;
  userPercentage: number;
  description: string;
  url: string;
  email: string;
}

const formSchema = z.object({
  app: z
    .string()
    .startsWith("0x", { message: "Must be a valid Ethereum address" }),
});

const ApproveForm: React.FC = () => {
  const { appAddress } = useParams<{ appAddress: string }>();
  const { isConnected } = useAccount();
  const { toast } = useToast();
  const engagementRewards = useEngagementRewards(env.rewardsContract); //{} as any  // Replace with actual contract address
  const { isSigningModalOpen, setIsSigningModalOpen, wrapWithSigningModal } =
    useSigningModal();

  const [previousDetails, setPreviousDetails] = useState<AppDetails | null>(
    null,
  );
  const [currentDetails, setCurrentDetails] = useState<AppDetails | null>(null);

  useEffect(() => {
    const loadAppDetails = async () => {
      if (!appAddress || !engagementRewards) return;

      // Get current details from contract
      const info = await engagementRewards.getAppInfo(
        appAddress as `0x${string}`,
      );
      setCurrentDetails({
        owner: info[0],
        rewardReceiver: info[1],
        userAndInviterPercentage: Number(info[5]),
        userPercentage: Number(info[6]),
        description: info[9],
        url: info[10],
        email: info[11],
      });

      // Get previous approved details from events
      const events = await engagementRewards.getAppHistory(
        appAddress as `0x${string}`,
      );
      if (events.length > 1) {
        const prevEvent = events[events.length - 2]; // Get second to last event
        setPreviousDetails({
          owner: prevEvent.owner,
          rewardReceiver: prevEvent.rewardReceiver,
          userAndInviterPercentage: Number(prevEvent.userAndInviterPercentage),
          userPercentage: Number(prevEvent.userPercentage),
          description: prevEvent.description,
          url: prevEvent.url,
          email: prevEvent.email,
        });
      }
    };

    loadAppDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appAddress, engagementRewards !== undefined]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      app: appAddress || "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    await wrapWithSigningModal(async () => {
      const receipt = await engagementRewards?.approve(
        values.app as `0x${string}`,
        (hash) => {
          toast({
            title: "Transaction Submitted",
            description: `Transaction hash: ${hash}`,
          });
        },
      );

      if (receipt?.status === "success") {
        form.reset();
      }
      return receipt;
    }, "The application has been approved successfully!");
  };

  if (!isConnected) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Approve Application</CardTitle>
          <CardDescription>
            Please connect your wallet to approve applications.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Approve Application</CardTitle>
          <CardDescription>
            Enter the app address to approve its application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {currentDetails && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">
                  Current Application Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    Owner: <TruncatedAddress address={currentDetails.owner} />
                  </div>
                  <div>
                    Receiver:{" "}
                    <TruncatedAddress address={currentDetails.rewardReceiver} />
                  </div>
                  <div>
                    User & Inviter: {currentDetails.userAndInviterPercentage}%
                  </div>
                  <div>User: {currentDetails.userPercentage}%</div>
                  <div>
                    URL:{" "}
                    <a
                      href={currentDetails.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {currentDetails.url}
                    </a>
                  </div>
                  <div>
                    Email:{" "}
                    <a href={`mailto:${currentDetails.email}`}>
                      {currentDetails.email}
                    </a>
                  </div>
                  <div className="col-span-2">
                    Description: {currentDetails.description}
                  </div>
                </div>
              </div>
            )}

            {previousDetails && (
              <div className="space-y-4 mt-8 pt-8 border-t">
                <h3 className="text-lg font-medium">
                  Previous Approved Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    Owner: <TruncatedAddress address={previousDetails.owner} />
                  </div>
                  <div>
                    Receiver:{" "}
                    <TruncatedAddress
                      address={previousDetails.rewardReceiver}
                    />
                  </div>
                  <div>
                    User & Inviter: {previousDetails.userAndInviterPercentage}%
                  </div>
                  <div>User: {previousDetails.userPercentage}%</div>
                  <div>
                    URL:{" "}
                    <a
                      href={previousDetails.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {previousDetails.url}
                    </a>
                  </div>
                  <div>
                    Email:{" "}
                    <a href={`mailto:${previousDetails.email}`}>
                      {previousDetails.email}
                    </a>
                  </div>
                  <div className="col-span-2">
                    Description: {previousDetails.description}
                  </div>
                </div>
              </div>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                <FormField
                  control={form.control}
                  name="app"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>App Contract Address</FormLabel>
                      <FormControl>
                        <Input placeholder="0x..." {...field} />
                      </FormControl>
                      <FormDescription>
                        The contract address of the app to approve
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit">Approve</Button>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
      <SigningModal
        open={isSigningModalOpen}
        onOpenChange={setIsSigningModalOpen}
      />
    </>
  );
};

export default ApproveForm;
