import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import SEO from "@/components/seo/SEO";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <SEO
        title="Page Not Found | Sanari AI"
        description="The page you are looking for does not exist. Return to Sanari AI for AI symptom assessment, online doctor consultations and pharmacy delivery."
        path={location.pathname}
        noindex
      />
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404 — Page not found</h1>
        <p className="mb-4 text-xl text-muted-foreground">
          This page doesn&apos;t exist or has moved.
        </p>
        <Link to="/" className="text-primary underline underline-offset-4 hover:opacity-80">
          Return to Sanari AI home
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
