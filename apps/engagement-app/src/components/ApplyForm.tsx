import React, { useState, useEffect } from "react";
import { useEngagementRewards } from "@goodsdks/engagement-sdk";
import { useAccount, usePublicClient } from "wagmi";
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
import { useForm, useWatch } from "react-hook-form";
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
import env from "@/env";
import { PublicClient, zeroAddress } from "viem";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useSigningModal } from "@/hooks/useSigningModal";
import { SigningModal } from "./SigningModal";
import { useParams } from "react-router-dom";
import {
  isContract,
  checkSourceVerification,
} from "@/utils/contract-verification";

const baseFormSchema = z.object({
  app: z.string().startsWith("0x"),
  rewardReceiver: z
    .string()
    .startsWith("0x", { message: "Must be a valid Ethereum address" }),
  userInviterPercentage: z.number().min(0).max(100),
  userPercentage: z.number().min(0).max(100),
  description: z
    .string()
    .min(50)
    .max(512, {
      message: "Description must be up to 512 characters and longer than 50",
    }),
  url: z.string().url().max(255),
  email: z.string().email().max(255),
});

const ApplyForm: React.FC = () => {
  const { appAddress } = useParams<{ appAddress: string }>();
  const { isConnected } = useAccount();
  const { toast } = useToast();
  const engagementRewards = useEngagementRewards(env.rewardsContract); // Replace with actual contract address
  const [isReapplying, setIsReapplying] = useState(false);
  const { isSigningModalOpen, setIsSigningModalOpen, wrapWithSigningModal } =
    useSigningModal();
  const publicClient = usePublicClient();
  const [verificationStatus, setVerificationStatus] = useState<{
    isVerified: boolean;
    checked: boolean;
  }>({
    isVerified: false,
    checked: false,
  });

  const form = useForm<z.infer<typeof baseFormSchema>>({
    resolver: (values, context, options) => {
      const schema = baseFormSchema.refine(
        () => !verificationStatus.checked || verificationStatus.isVerified,
        {
          path: ["app"],
          message: "Contract must be verified on Sourcify",
        },
      );
      return zodResolver(schema)(values, context, options);
    },
    defaultValues: {
      app: appAddress,
      rewardReceiver: "",
      userInviterPercentage: 50,
      userPercentage: 25,
      description: "",
      url: "",
      email: "",
    },
  });

  const appValue = useWatch({
    control: form.control,
    name: "app",
  });

  useEffect(() => {
    const handleAppChange = async () => {
      // Reset reapplying status
      setIsReapplying(false);
      if (
        !publicClient ||
        !appValue ||
        !appValue.startsWith("0x") ||
        appValue.length !== 42
      )
        return;

      // Check if app exists
      const appInfo = await engagementRewards?.getAppInfo(
        appValue as `0x${string}`,
      );
      if (appInfo?.[0] !== zeroAddress) {
        setIsReapplying(true);
      }

      // Check contract verification
      const contractStatus = await isContract(
        publicClient as PublicClient,
        appValue,
      );
      let verifiedStatus = true;
      if (contractStatus) {
        const chainId = await publicClient.getChainId();
        verifiedStatus = await checkSourceVerification(appValue, chainId);
      }
      setVerificationStatus({
        isVerified: verifiedStatus,
        checked: true,
      });
    };

    handleAppChange();
  }, [appValue, !!engagementRewards, !!publicClient]);

  const onSubmit = async (values: z.infer<typeof baseFormSchema>) => {
    if (!isConnected || !engagementRewards) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    await wrapWithSigningModal(async () => {
      const receipt = await engagementRewards.applyApp(
        values.app as `0x${string}`,
        {
          rewardReceiver: values.rewardReceiver as `0x${string}`,
          userAndInviterPercentage: values.userInviterPercentage,
          userPercentage: values.userPercentage,
          description: values.description,
          url: values.url,
          email: values.email,
        },
        (hash: string) => {
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
    }, "Your application has been submitted successfully!");
  };

  if (!isConnected) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Apply for Engagement Rewards</CardTitle>
          <CardDescription>
            Please connect your wallet to apply for rewards.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Apply for Engagement Rewards</CardTitle>
          <CardDescription>
            Fill out this form to apply for engagement rewards for your app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="app"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>App Address</FormLabel>
                    <FormControl>
                      <Input placeholder="0x..." {...field} />
                    </FormControl>
                    <FormDescription>
                      The contract address of your app or a backend wallet
                      signer address
                    </FormDescription>
                    {verificationStatus.checked &&
                      !verificationStatus.isVerified && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Unverified Contract</AlertTitle>
                          <AlertDescription>
                            The contract must be verified on Sourcify.dev before
                            it can be registered
                          </AlertDescription>
                        </Alert>
                      )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rewardReceiver"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reward Receiver Address</FormLabel>
                    <FormControl>
                      <Input placeholder="0x..." {...field} />
                    </FormControl>
                    <FormDescription>
                      The address that will receive the rewards
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="userInviterPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User+Inviter Percentage</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(+e.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Percentage of rewards allocated to users and inviters
                      (0-100)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="userPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Percentage</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(+e.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Percentage of user+inviter rewards allocated to users
                      (0-100)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter a short description..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A short description and terms of your app (up to 512
                      characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>App URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormDescription>
                      The URL where your app is hosted
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="contact@..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Contact email for app-related communications
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isReapplying && (
                <Alert>
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    This app is already registered. Re-applying will mark it as
                    unapproved until reviewed again.
                  </AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={!verificationStatus.isVerified}>
                Apply
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <SigningModal
        open={isSigningModalOpen}
        onOpenChange={setIsSigningModalOpen}
      />
    </>
  );
};

export default ApplyForm;
