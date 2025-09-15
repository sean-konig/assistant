"use client"

import type React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Settings, Mail, Calendar, MessageSquare, CheckCircle, XCircle, ExternalLink, AlertCircle } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface Integration {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  connected: boolean
  lastSync?: string
  features: string[]
  oauthUrl?: string
  status: "connected" | "disconnected" | "error" | "syncing"
  errorMessage?: string
}

const integrations: Integration[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Sync emails and automatically create tasks from important messages",
    icon: Mail,
    connected: false,
    features: ["Email to Task Conversion", "Smart Categorization", "Attachment Handling"],
    oauthUrl: "https://accounts.google.com/oauth/authorize?client_id=example&scope=gmail",
    status: "disconnected",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Import meetings and sync calendar events with your projects",
    icon: Calendar,
    connected: true,
    lastSync: "2024-01-11T10:30:00Z",
    features: ["Meeting Import", "Calendar Sync", "Event Creation", "Attendee Management"],
    oauthUrl: "https://accounts.google.com/oauth/authorize?client_id=example&scope=calendar",
    status: "connected",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get notifications and create tasks from Slack messages",
    icon: MessageSquare,
    connected: false,
    features: ["Message to Task", "Channel Notifications", "Status Updates"],
    oauthUrl: "https://slack.com/oauth/v2/authorize?client_id=example&scope=chat:write",
    status: "error",
    errorMessage: "Authentication expired. Please reconnect.",
  },
]

export default function IntegrationsPage() {
  const [integrationStates, setIntegrationStates] = useState(integrations)
  const { toast } = useToast()

  const handleConnect = (integrationId: string) => {
    const integration = integrationStates.find((i) => i.id === integrationId)
    if (integration?.oauthUrl) {
      // In a real app, this would open OAuth flow
      window.open(integration.oauthUrl, "_blank", "width=600,height=600")

      // Simulate connection after OAuth (in real app, this would be handled by callback)
      setTimeout(() => {
        setIntegrationStates((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? { ...i, connected: true, status: "connected" as const, lastSync: new Date().toISOString() }
              : i,
          ),
        )
        toast({
          title: "Integration connected",
          description: `${integration.name} has been successfully connected.`,
        })
      }, 2000)
    }
  }

  const handleDisconnect = (integrationId: string) => {
    const integration = integrationStates.find((i) => i.id === integrationId)

    setIntegrationStates((prev) =>
      prev.map((i) =>
        i.id === integrationId ? { ...i, connected: false, status: "disconnected" as const, lastSync: undefined } : i,
      ),
    )

    toast({
      title: "Integration disconnected",
      description: `${integration?.name} has been disconnected.`,
    })
  }

  const handleSync = (integrationId: string) => {
    const integration = integrationStates.find((i) => i.id === integrationId)

    setIntegrationStates((prev) => prev.map((i) => (i.id === integrationId ? { ...i, status: "syncing" as const } : i)))

    // Simulate sync process
    setTimeout(() => {
      setIntegrationStates((prev) =>
        prev.map((i) =>
          i.id === integrationId ? { ...i, status: "connected" as const, lastSync: new Date().toISOString() } : i,
        ),
      )

      toast({
        title: "Sync completed",
        description: `${integration?.name} data has been synchronized.`,
      })
    }, 3000)
  }

  const getStatusIcon = (status: Integration["status"]) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "disconnected":
        return <XCircle className="h-4 w-4 text-gray-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "syncing":
        return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    }
  }

  const getStatusBadge = (status: Integration["status"]) => {
    switch (status) {
      case "connected":
        return (
          <Badge variant="secondary" className="bg-green-500 text-white">
            Connected
          </Badge>
        )
      case "disconnected":
        return <Badge variant="outline">Disconnected</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      case "syncing":
        return (
          <Badge variant="secondary" className="bg-blue-500 text-white">
            Syncing...
          </Badge>
        )
    }
  }

  const connectedCount = integrationStates.filter((i) => i.connected).length
  const totalCount = integrationStates.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your integrations and preferences</p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Total Integrations</span>
            </div>
            <div className="text-2xl font-bold mt-2">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Connected</span>
            </div>
            <div className="text-2xl font-bold mt-2">{connectedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Available</span>
            </div>
            <div className="text-2xl font-bold mt-2">{totalCount - connectedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Available Integrations</h2>

        {integrationStates.map((integration) => (
          <Card key={integration.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <integration.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{integration.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{integration.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(integration.status)}
                  {getStatusBadge(integration.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Error Message */}
                {integration.status === "error" && integration.errorMessage && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{integration.errorMessage}</AlertDescription>
                  </Alert>
                )}

                {/* Features */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Features</h4>
                  <div className="flex flex-wrap gap-2">
                    {integration.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Last Sync */}
                {integration.lastSync && (
                  <div className="text-xs text-muted-foreground">
                    Last synced: {new Date(integration.lastSync).toLocaleString()}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-4">
                    {integration.connected && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={integration.connected}
                          onCheckedChange={() => handleDisconnect(integration.id)}
                        />
                        <span className="text-sm">Enabled</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {integration.connected ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(integration.id)}
                          disabled={integration.status === "syncing"}
                        >
                          {integration.status === "syncing" ? "Syncing..." : "Sync Now"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDisconnect(integration.id)}>
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => handleConnect(integration.id)} className="gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Integrations help you connect your existing tools and workflows with the Executive Assistant. Each
              integration provides different features to enhance your productivity.
            </p>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Getting Started:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Click "Connect" on any integration to start the OAuth flow</li>
                <li>• Grant the necessary permissions in the popup window</li>
                <li>• Once connected, data will automatically sync in the background</li>
                <li>• Use "Sync Now" to manually refresh data when needed</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Troubleshooting:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• If an integration shows an error, try disconnecting and reconnecting</li>
                <li>• Check that you have the necessary permissions in the connected service</li>
                <li>• Contact support if you continue to experience issues</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
