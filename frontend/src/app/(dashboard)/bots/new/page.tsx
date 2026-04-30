import { BotForm } from "@/components/bots/BotForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function NewBotPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/bots"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver a bots
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo chatbot</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configura tu bot y conéctalo a WhatsApp
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <BotForm />
      </div>
    </div>
  );
}
