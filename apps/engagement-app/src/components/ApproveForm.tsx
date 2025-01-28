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

import env from '@/env'

const formSchema = z.object({
  app: z.string().startsWith("0x", { message: "Must be a valid Ethereum address" }),
})

const ApproveForm: React.FC = () => {
  const { appAddress } = useParams<{ appAddress: string }>();
  const { isConnected } = useAccount()
  const { toast } = useToast()
  const engagementRewards =  useEngagementRewards(env.rewardsContract) //{} as any  // Replace with actual contract address

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

    try {
      const receiptP = engagementRewards?.approve(values.app as `0x${string}`)
      toast({
        title: "Approval Submitted",
        description: "Your approval is being processed...",
      })
      const receipt = await receiptP
     
      
      
      if (receipt?.status === "success") {
        toast({
          title: "Approval Successful",
          description: "The application has been approved successfully!",
          variant: "default",
        })
        form.reset()
      } else {
        toast({
          title: "Transaction Failed",
          description: "The approval could not be processed. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error approving:', error)
      toast({
        title: "Error",
        description: `Error: ${(error as Error).message}`,
        variant: "destructive",
      })
    }
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
  )
}

export default ApproveForm

