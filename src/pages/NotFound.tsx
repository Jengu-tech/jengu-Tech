import { useLocation } from "react-router-dom";

const NotFound = () => {
  // SÉCURITÉ : on n'imprime plus le pathname dans la console (peut contenir
  // des identifiants sensibles dans l'URL).
  useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
