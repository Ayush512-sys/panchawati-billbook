import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../api';
import { Loader2, AlertCircle, KeyRound, UserCheck } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleFillDemo = () => {
    setEmail('admin');
    setPassword('admin123');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });
      login(data.user, data.token);
      navigate('/');
    } catch (err: any) {
      console.error('Login failed:', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Network error: Unable to reach the server. Please check internet connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-gray-50 dark:bg-zinc-950 px-4 py-8">
      <div className="z-10 w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col items-center justify-center space-y-2 border-b border-gray-100 bg-gray-50/50 px-6 py-6 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md mb-1">
            PB
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Panchawati BillBook</h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Inventory & Billing Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col space-y-4 px-6 py-6">
          {error && (
            <div className="flex items-start p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-zinc-300 mb-1">
              Username or Email
            </label>
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              placeholder="e.g. admin or admin@panchawati.com"
              className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm placeholder-gray-400 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-zinc-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm placeholder-gray-400 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
            />
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white shadow-md hover:bg-indigo-700 focus:outline-none active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          {/* Quick Auto-Fill Admin Helper */}
          <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 text-center">
            <button
              type="button"
              onClick={handleFillDemo}
              className="inline-flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1" />
              Fill Admin Credentials (admin / admin123)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
