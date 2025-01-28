import React from 'react'
import {useEngagementRewards} from '@goodsdks/engagement-sdk'
import { useAccount,useConfig } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
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
  rewardReceiver: z.string().startsWith("0x", { message: "Must be a valid Ethereum address" }),
  userInviterPercentage: z.number().min(0).max(100),
  userPercentage: z.number().min(0).max(100),
  description: z.string().min(50).max(512, { message: "Description must be up to 512 characters and longer than 50" }),
})

const ApplyForm: React.FC = () => {
  const { isConnected } = useAccount()
  const wagmiConfig = useConfig()
  const { toast } = useToast()
  const engagementRewards = useEngagementRewards(env.rewardsContract)  // Replace with actual contract address

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      app: "",
      rewardReceiver: "",
      userInviterPercentage: 50,
      userPercentage: 25,
      description: "",
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
      

      const txHash =  await engagementRewards?.applyApp(
        values.app as `0x${string}`,
        values.rewardReceiver as `0x${string}`,
        values.userInviterPercentage,
        values.userPercentage,
        values.description
      )
      toast({
        title: "Application Submitted",
        description: "Your application is being processed...",
      })
      if(!txHash) return
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
      
      if (receipt?.status === "success") {
        toast({
          title: "Application Successful",
          description: "Your application has been submitted successfully!",
          variant: "default"
        })
        form.reset()
      } else {
        toast({
          title: "Transaction Failed",
          description: "Your application could not be processed. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error applying:', error)
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
          <CardTitle>Apply for Engagement Rewards</CardTitle>
          <CardDescription>Please connect your wallet to apply for rewards.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Apply for Engagement Rewards</CardTitle>
        <CardDescription>Fill out this form to apply for engagement rewards for your app.</CardDescription>
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
                    The contract address of your app
                  </FormDescription>
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
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter a short description..." {...field} />
                  </FormControl>
                  <FormDescription>
                    A short description and terms of your app (up to 512 characters)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Apply</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default ApplyForm

