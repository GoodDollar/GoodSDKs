import React from 'react'
import  {useEngagementRewards} from '@GoodSDKs/engagement-sdk'
import { useParams } from "react-router-dom";
import { useAccount } from 'wagmi'
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useSigningModal } from "@/hooks/useSigningModal"
import { SigningModal } from "./SigningModal"

import env from '@/env'

const formSchema = z.object({
  app: z.string().startsWith("0x", { message: "Must be a valid Ethereum address" }),
})

const ApproveForm: React.FC = () => {
  const { appAddress } = useParams<{ appAddress: string }>();
  const { isConnected } = useAccount()
  const { toast } = useToast()
  const engagementRewards =  useEngagementRewards(env.rewardsContract) //{} as any  // Replace with actual contract address
  const { isSigningModalOpen, setIsSigningModalOpen, wrapWithSigningModal } = useSigningModal();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      app: appAddress || "",
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }

    await wrapWithSigningModal(
      async () => {
        const receipt = await engagementRewards?.approve(
          values.app as `0x${string}`,
          (hash) => {
            toast({
              title: "Transaction Submitted",
              description: `Transaction hash: ${hash}`,
            });
          }
        );
        
        if (receipt?.status === "success") {
          form.reset();
        }
        return receipt;
      },
      "The application has been approved successfully!"
    );
  }

  if (!isConnected) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Approve Application</CardTitle>
          <CardDescription>Please connect your wallet to approve applications.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Approve Application</CardTitle>
          <CardDescription>Enter the app address to approve its application.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
        </CardContent>
      </Card>
      <SigningModal 
        open={isSigningModalOpen} 
        onOpenChange={setIsSigningModalOpen}
      />
    </>
  )
}

export default ApproveForm

