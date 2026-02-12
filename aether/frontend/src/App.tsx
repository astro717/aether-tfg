import { BrowserRouter, Routes, Route } from "react-router-dom";

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
import { OrganizationProvider } from "./modules/organization/context/OrganizationContext";
import { AuthProvider } from "./modules/auth/context/AuthContext";
import { ThemeProvider } from "./modules/settings/context/ThemeContext";
import { SettingsProvider } from "./modules/settings/context/SettingsContext";
import { NotificationsProvider } from "./modules/notifications/context/NotificationsContext";
import { ToastProvider } from "./components/ui/Toast";

function App() {
  return (
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
                  </Routes>
                </BrowserRouter>
              </OrganizationProvider>
            </NotificationsProvider>
          </AuthProvider>
        </ToastProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
