import React, { useEffect } from 'react'
import { useEngagementRewards } from '@goodsdks/engagement-sdk'
import { useToast } from "@/hooks/use-toast"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import {
  Form,
} from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import env from '@/env'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useSigningModal } from "@/hooks/useSigningModal"
import { SigningModal } from "./SigningModal"
import { useParams } from 'react-router-dom'

const formSchema = z.object({
  rewardReceiver: z.string().startsWith("0x"),
  userInviterPercentage: z.number().min(0).max(100),
  userPercentage: z.number().min(0).max(100),
});

export const UpdateAppSettingsForm: React.FC = () => {
  const { appAddress:app } = useParams<{ appAddress: string }>()

  const engagementRewards = useEngagementRewards(env.rewardsContract);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  const { isSigningModalOpen, setIsSigningModalOpen, wrapWithSigningModal } = useSigningModal();

  useEffect(() => {
    const loadAppSettings = async () => {
      const appInfo = await engagementRewards?.getAppInfo(app as `0x${string}`);
      if (appInfo) {
        form.reset({
            rewardReceiver: appInfo[1], // array index for rewardReceiver
            userInviterPercentage: Number(appInfo[5]), // array index for userAndInviterPercentage
            userPercentage: Number(appInfo[6]), // array index for userPercentage
        });
      }
    };
    loadAppSettings();
  }, [app, !!engagementRewards]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await wrapWithSigningModal(
      async () => {
        const receipt = await engagementRewards?.updateAppSettings(
          app as `0x${string}`,
          values.rewardReceiver as `0x${string}`,
          values.userInviterPercentage,
          values.userPercentage,
          (hash) => {
            toast({
              title: "Transaction Submitted",
              description: `Transaction hash: ${hash}`,
            });
          }
        );
        return receipt;
      },
      "App settings have been successfully updated."
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Update App Settings</CardTitle>
          <CardDescription>Modify your app's reward distribution settings</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                      <Input type="number" {...field} onChange={e => field.onChange(+e.target.value)} />
                    </FormControl>
                    <FormDescription>
                      Percentage of rewards allocated to users and inviters (0-100)
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
                      <Input type="number" {...field} onChange={e => field.onChange(+e.target.value)} />
                    </FormControl>
                    <FormDescription>
                      Percentage of user+inviter rewards allocated to users (0-100)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Update Settings</Button>
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
