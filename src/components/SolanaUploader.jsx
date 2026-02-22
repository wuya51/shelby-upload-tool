import { useState, useCallback, useEffect } from 'react';
import { shelbyClient } from '../utils/shelbyClient';
import { useUploadBlobs } from '@shelby-protocol/react';
import { useStorageAccount } from '@shelby-protocol/solana-kit/react';
import { useWalletConnection } from '@solana/react-hooks';

export function SolanaUploader({
  currentStep,
  fundedStorageAddress,
  onFirstBlobUploaded,
  showMessage
}) {
  const { wallet, status } = useWalletConnection();
  const connected = status === 'connected';
  
  const { storageAccountAddress, signAndSubmitTransaction } = useStorageAccount({
    client: shelbyClient,
    wallet,
  });



  const { mutateAsync: uploadBlobs, isPending: isUploading } = useUploadBlobs({
    client: shelbyClient,
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedBlobs, setUploadedBlobs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fundedStorageAddress) {
      setUploadedBlobs([]);
    }
  }, [fundedStorageAddress]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isDuplicate = uploadedBlobs.some((blob) => blob.name === file.name);
    if (isDuplicate) {
      showMessage(`A blob named "${file.name}" already exists.`, 'error');
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !storageAccountAddress || !signAndSubmitTransaction) return;

    if (uploadedBlobs.some((blob) => blob.name === selectedFile.name)) {
      showMessage(`A blob named "${selectedFile.name}" already exists.`, 'error');
      return;
    }

    try {
      setLoading(true);

      const arrayBuffer = await selectedFile.arrayBuffer();
      const blobData = new Uint8Array(arrayBuffer);

      const expirationMicros = (Date.now() + 30 * 24 * 60 * 60 * 1000) * 1000;

      await uploadBlobs({
        signer: {
          account: storageAccountAddress,
          signAndSubmitTransaction,
        },
        blobs: [{
          blobName: selectedFile.name,
          blobData,
        }],
        expirationMicros,
      });

      const blobUrl = `https://api.shelbynet.shelby.xyz/shelby/v1/blobs/${storageAccountAddress.toString()}/${encodeURIComponent(selectedFile.name)}`;

      const isFirstUpload = uploadedBlobs.length === 0;

      setUploadedBlobs(prev => [{
        name: selectedFile.name,
        url: blobUrl,
        uploadedAt: new Date(),
      }, ...prev]);

      setSelectedFile(null);
      showMessage(`File uploaded successfully! URL: ${blobUrl}`, 'success');

      if (isFirstUpload && onFirstBlobUploaded) {
        onFirstBlobUploaded();
      }

      const fileInput = document.getElementById('blob-file-upload');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE')) {
        showMessage('Your account needs funding before uploading. Please click "Fund Account" to add APT for transaction fees.', 'error');
      } else if (errorMessage.includes('E_INSUFFICIENT_FUNDS')) {
        showMessage('Your account needs more ShelbyUSD to pay for storage. Please click "Fund Account" to add ShelbyUSD tokens.', 'error');
      } else {
        showMessage(`Upload failed: ${errorMessage}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedFile, storageAccountAddress, signAndSubmitTransaction, uploadBlobs, uploadedBlobs, onFirstBlobUploaded, showMessage]);

  const handleFileInputClick = useCallback(() => {
    document.getElementById('blob-file-upload')?.click();
  }, []);

  const isDisabled = !connected || !fundedStorageAddress;

  const showFileInputGlow = currentStep === 2 && !selectedFile;
  const showUploadGlow = currentStep === 2 && !!selectedFile;

  return (
    <div className="glass-neon rounded-xl p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Upload Files
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Upload files to your Shelby storage account. Your Solana wallet will sign the transaction.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-yellow-800">Important Note</p>
              <p className="text-yellow-700 mt-1">
                Please switch to Solana Devnet before uploading files. Your wallet must be connected to Solana Devnet to use this application.
              </p>
            </div>
          </div>
        </div>
      </div>

      {isDisabled ? (
        <div className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
          <p className="text-sm text-muted-foreground">
            {!connected
              ? 'Connect your Solana wallet first to upload blobs.'
              : 'Fund your storage account first to upload blobs.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <input
              id="blob-file-upload"
              type="file"
              onChange={handleFileChange}
              className="sr-only"
            />
            <button
              type="button"
              onClick={handleFileInputClick}
              className={`w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:from-purple-700 hover:to-purple-800 transform hover:-translate-y-1 ${showFileInputGlow ? 'glow-pulse' : ''}`}
            >
              Choose File
            </button>
          </div>

          {selectedFile && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-white/5 rounded-lg border border-white/10 gap-4">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Selected:</span>
                <span className="text-sm font-medium text-foreground truncate flex-1">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading || loading}
                className={`px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-md hover:bg-blue-700 font-medium transition-all duration-300 hover:shadow-lg hover:from-purple-700 hover:to-purple-800 transform hover:-translate-y-0.5 ${showUploadGlow ? 'glow-pulse' : ''}`}
              >
                {isUploading || loading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          )}


        </div>
      )}

      {uploadedBlobs.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Uploaded Blobs
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {uploadedBlobs.map((blob, index) => (
              <div
                key={`${blob.name}-${index}`}
                className="p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground truncate flex-1">
                    {blob.name}
                  </span>
                  <a
                    href={blob.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md text-[var(--poline-accent-9)] hover:text-[var(--poline-surface-1)] hover:bg-[var(--poline-accent-9)] transition-colors shrink-0"
                    title="View blob"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </a>
                </div>

                <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                  {blob.url}
                </p>

                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {blob.uploadedAt.toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}