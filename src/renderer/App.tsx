import { Route, Routes } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { HomePage } from "@/pages/home";
import { SettingsPage } from "@/pages/settings";
import { ModelsPage } from "@/pages/models";
import { DictionaryPage } from "@/pages/dictionary";
import { LlmPage } from "@/pages/llm";

export default function App() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/dictionary" element={<DictionaryPage />} />
          <Route path="/llm" element={<LlmPage />} />
        </Routes>
      </main>
    </div>
  );
}
