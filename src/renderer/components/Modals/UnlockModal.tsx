import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function UnlockModal() {
  const {
    isVaultLocked,
    isVaultSetup,
    unlockVault,
    setupVault,
    checkVaultStatus,
    openVaultResetModal,
  } = useStore();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check vault status on mount
    const check = async () => {
      setIsChecking(true);
      await checkVaultStatus();
      setIsChecking(false);
    };
    check();
  }, [checkVaultStatus]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await window.api.encryption.unlock(password);
      if (res.success) {
        await unlockVault();
        setPassword('');
      } else {
        setError(res.error || 'Invalid password');
      }
    } catch (err) {
      setError('Failed to unlock vault');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter a password');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await window.api.encryption.setup(password);
      if (res.success) {
        await setupVault();
        setPassword('');
        setConfirmPassword('');
      } else {
        setError(res.error || 'Failed to set up encryption');
      }
    } catch (err) {
      setError('Failed to set up encryption');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if vault is unlocked or still checking
  if (isChecking) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-dark-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-dark-400 text-sm">Checking security...</span>
        </div>
      </div>
    );
  }

  if (!isVaultLocked && isVaultSetup) {
    return null;
  }

  // Setup screen (first time)
  if (!isVaultSetup) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-dark-950">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-2xl flex items-center justify-center text-4xl shadow-glow">
              🚀
            </div>
            <h1 className="text-3xl font-bold gradient-text mb-2">LaunchIt</h1>
            <p className="text-dark-400">Set up your master password</p>
          </div>

          {/* Setup Form */}
          <form onSubmit={handleSetup} className="bg-dark-900 border border-dark-700 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3 p-4 bg-accent-primary/10 rounded-xl border border-accent-primary/20">
              <Shield className="w-6 h-6 text-accent-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-dark-100">Secure your credentials</p>
                <p className="text-xs text-dark-400 mt-1">
                  Your master password encrypts all stored passwords and credentials.
                </p>
              </div>
            </div>

            <div>
              <label className="input-label">Master Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password"
                  className="input-base pl-10 pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-dark-500 mt-1">Minimum 8 characters</p>
            </div>

            <div>
              <label className="input-label">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm master password"
                  className="input-base pl-10"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-accent-danger/10 text-accent-danger rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Create Master Password
                </>
              )}
            </button>

            <p className="text-xs text-dark-500 text-center">
              ⚠️ There is no way to recover your password. Please remember it!
            </p>
          </form>

          {/* Version Label */}
          <div className="absolute bottom-4 right-4 text-xs text-dark-500 font-mono opacity-50">
            v1.3.0
          </div>
        </div>
      </div>
    );
  }

  // Unlock screen
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-dark-950">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-dark-700 to-dark-800 rounded-2xl flex items-center justify-center text-4xl border border-dark-600">
            <Lock className="w-10 h-10 text-dark-400" />
          </div>
          <h2 className="text-2xl font-bold gradient-text mb-1">LaunchIt</h2>
          <h1 className="text-xl font-medium text-dark-200 mb-2">Vault Locked</h1>
          <p className="text-dark-400">Enter your master password to continue</p>
        </div>

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="bg-dark-900 border border-dark-700 rounded-2xl p-6 space-y-6">
          <div>
            <label className="input-label">Master Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password"
                className="input-base pl-10 pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={openVaultResetModal}
              className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-accent-danger/10 text-accent-danger rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Unlocking...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Unlock Vault
              </>
            )}
          </button>
        </form>
      </div>

      {/* Version Label */}
      <div className="absolute bottom-4 right-4 text-xs text-dark-500 font-mono opacity-50">
        v1.3.0
      </div>
    </div>
  );
}

