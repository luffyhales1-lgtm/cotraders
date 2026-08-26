import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import Index from "./pages/Index";
import AiSignals from "./pages/AiSignals";
import ProChartsPage from "./pages/ProChartsPage";
import MarketScannerPage from "./pages/MarketScannerPage";
import NewsPage from "./pages/NewsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import PricingPage from "./pages/PricingPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import BotSettings from "./pages/BotSettings"; // Import the new page
import JournalPage from "./pages/JournalPage";
import ChartAnalyzerPage from "./pages/ChartAnalyzerPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/signals" element={<AiSignals />} />
            <Route path="/charts" element={<ProChartsPage />} />
            <Route path="/scanner" element={<MarketScannerPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/analyze" element={<ChartAnalyzerPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/bot-settings" element={<BotSettings />} /> {/* Add the new route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
