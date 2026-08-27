import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-rose-50">
      <div className="text-center">
        <h1 className="text-4xl font-black mb-4 text-slate-900">404</h1>
        <p className="text-xl text-slate-600 mb-4">Oops! Page not found</p>
        <a href="/" className="text-indigo-600 hover:text-indigo-500 font-bold underline">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
