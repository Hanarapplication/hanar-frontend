export default function Footer() {
    return (
      <footer className="hidden sm:block text-sm text-gray-500 text-center py-6 mt-10 border-t border-gray-200">
        <p className="space-x-4">
          <a href="/terms" className="hover:underline text-blue-600">Terms of Service</a>
          <a href="/privacy" className="hover:underline text-blue-600">Privacy Policy</a>
          <a href="/contact" className="hover:underline text-blue-600">Contact Us</a>
        </p>
        <p className="mt-2 text-xs text-gray-400">© {new Date().getFullYear()} Hanar</p>
      </footer>
    );
  }
  