import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { HomePage } from "./modules/auth/pages/HomePage";
import { SignupPage } from "./modules/auth/pages/SignupPage";
import { LoginPage } from "./modules/auth/pages/LoginPage";
import { ConnectGithubPage } from "./modules/auth/pages/ConnectGithubPage";
import { GithubCallbackPage } from "./modules/auth/pages/GithubCallbackPage";
import { OrganizationSetupPage } from "./modules/auth/pages/OrganizationSetupPage";
import { ForgotPasswordPage } from "./modules/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./modules/auth/pages/ResetPasswordPage";

import { DashboardLayout } from "./components/layout/DashboardLayout";
import { TaskDetailsPage } from "./modules/tasks/pages/TaskDetailsPage";
import { MainDashboardPage } from "./modules/dashboard/pages/MainDashboardPage";
import { MessagingPage } from "./modules/messaging/pages/MessagingPage";
import { SettingsPage } from "./modules/settings/pages/SettingsPage";
import { ManagerZonePage } from "./modules/manager/pages/ManagerZonePage";
import { AnalyticsDashboardV2Page } from "./modules/manager/pages/AnalyticsDashboardV2Page";
import { AnalyticsDashboardV4 } from "./modules/manager/pages/AnalyticsDashboardV4";
import { AnalyticsDashboardV3Page } from "./modules/manager/pages/AnalyticsDashboardV3Page";
import { ProtectedManagerRoute } from "./components/auth/ProtectedManagerRoute";
import { OrganizationProvider } from "./modules/organization/context/OrganizationContext";
import { AuthProvider } from "./modules/auth/context/AuthContext";
import { ThemeProvider } from "./modules/settings/context/ThemeContext";
import { SettingsProvider } from "./modules/settings/context/SettingsContext";
import { NotificationsProvider } from "./modules/notifications/context/NotificationsContext";
import { ToastProvider } from "./components/ui/Toast";

// Create a stable QueryClient instance outside the component
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsProvider>
          <ToastProvider>
            <AuthProvider>
              <NotificationsProvider>
                <OrganizationProvider>
                  <BrowserRouter>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/signup" element={<SignupPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/connect-github" element={<ConnectGithubPage />} />
                      <Route path="/connect/github/callback" element={<GithubCallbackPage />} />
                      <Route path="/organization-setup" element={<OrganizationSetupPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />

                      {/* Dashboard Routes */}
                      <Route
                        path="/tasks/:taskId"
                        element={
                          <DashboardLayout>
                            <TaskDetailsPage />
                          </DashboardLayout>
                        }
                      />

                      <Route
                        path="/dashboard"
                        element={
                          <DashboardLayout>
                            <MainDashboardPage />
                          </DashboardLayout>
                        }
                      />

                      {/* Messaging Route */}
                      <Route
                        path="/messages"
                        element={
                          <DashboardLayout>
                            <MessagingPage />
                          </DashboardLayout>
                        }
                      />

                      {/* Settings Route */}
                      <Route
                        path="/settings"
                        element={
                          <DashboardLayout>
                            <SettingsPage />
                          </DashboardLayout>
                        }
                      />

                      {/* Manager Zone Route */}
                      <Route
                        path="/manager"
                        element={
                          <ProtectedManagerRoute>
                            <DashboardLayout>
                              <ManagerZonePage />
                            </DashboardLayout>
                          </ProtectedManagerRoute>
                        }
                      />

                      {/* Analytics V2 (BETA) */}
                      <Route
                        path="/manager/analytics-v2"
                        element={
                          <ProtectedManagerRoute>
                            <DashboardLayout>
                              <AnalyticsDashboardV2Page />
                            </DashboardLayout>
                          </ProtectedManagerRoute>
                        }
                      />

                      {/* Analytics V3 (experimental — KPIs & Signals redesign) */}
                      <Route
                        path="/manager/analytics-v3"
                        element={
                          <ProtectedManagerRoute>
                            <DashboardLayout>
                              <AnalyticsDashboardV3Page />
                            </DashboardLayout>
                          </ProtectedManagerRoute>
                        }
                      />

                      {/* Analytics V4 (premium) */}
                      <Route
                        path="/manager/analytics-v4"
                        element={
                          <ProtectedManagerRoute>
                            <DashboardLayout>
                              <AnalyticsDashboardV4 />
                            </DashboardLayout>
                          </ProtectedManagerRoute>
                        }
                      />
                    </Routes>
                  </BrowserRouter>
                </OrganizationProvider>
              </NotificationsProvider>
            </AuthProvider>
          </ToastProvider>
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
