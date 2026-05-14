import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.tsx';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const clerkAppearance = {
  variables: {
    colorPrimary: '#4F46E5', // Indigo 600
    colorBackground: '#FFFFFF',
    colorText: '#1F2937', 
    colorInputBackground: '#FFFFFF',
    colorInputText: '#1F2937',
    borderRadius: '0.75rem', 
    fontFamily: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"
  },
  elements: {
    card: "bg-white shadow-xl border border-gray-200 rounded-2xl",
    headerTitle: "text-2xl font-bold text-gray-900",
    headerSubtitle: "text-gray-500 mb-4",
    formFieldLabel: "text-sm font-medium text-gray-700 mb-1.5 block", // Memaksa label di atas input
    formFieldInput: "w-full border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2.5 px-3 mb-1",
    formButtonPrimary: "w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors normal-case mt-2 shadow-sm",
    footerActionLink: "text-indigo-600 hover:text-indigo-700 font-medium",
    socialButtonsBlockButton: "border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700",
  }
};

const AppWrapper = () => {
  if (!PUBLISHABLE_KEY) {
    // If no key, just run without Clerk for preview purposes
    console.warn("Clerk Publishable Key is missing from .env. Running without auth.");
    return (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={clerkAppearance}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWrapper />
  </StrictMode>,
);
