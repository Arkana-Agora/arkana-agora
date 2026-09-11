"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { ReactNode } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface AuthLayoutProps {
  children: ReactNode
}

const animationVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
    },
  },
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <motion.div
      variants={animationVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-gray-900 dark:via-purple-950 dark:to-gray-900"
      data-testid="auth-layout-container"
    >
      <div className="container mx-auto px-4 py-12 md:py-16 lg:py-20">
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center min-h-[600px]"
          data-testid="auth-layout-grid"
        >
          <motion.div
            variants={animationVariants}
            transition={{ delay: 0.1 }}
            className="order-1 lg:order-1"
          >
            <Card className="border-0 shadow-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <CardHeader className="space-y-1">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                  Arkana Agora
                </h1>
                <p className="text-sm text-muted-foreground">
                  Entre para sua jornada espiritual
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">{children}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            variants={animationVariants}
            transition={{ delay: 0.2 }}
            className="order-2 lg:order-2 flex items-center justify-center"
          >
            <div className="relative w-full max-w-md h-96 lg:h-[600px]">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-500 rounded-3xl opacity-20 blur-3xl" />
              <Image
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                alt="Arkana Agora spiritual journey"
                fill
                className="rounded-3xl shadow-2xl object-cover"
                priority
              />
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
