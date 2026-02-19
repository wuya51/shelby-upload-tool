import React, { useState, useEffect, useRef } from 'react';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { useWalletConnection, useClientStore } from "@solana/react-hooks";
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { BrowserRouter as Router, Routes, Link, Route } from 'react-router-dom';
import { Aptos, AptosConfig, Network as AptosNetwork, AccountAddress } from "@aptos-labs/ts-sdk";
import { useStorageAccount, Network } from "@shelby-protocol/solana-kit/react";
import { useUploadBlobs } from "@shelby-protocol/react";
import Blobs from './pages/Blobs';
import { useSolanaNetwork } from './SolanaWalletProvider.jsx';

function UploadPage({ signAndSubmitTransaction, showMessage }) {
  const { connected, account, network } = useAptosWallet();
  const { wallet, status: solanaStatus, connectors, connect: solanaConnect, disconnect: solanaDisconnect } = useWalletConnection();
  const { currentNetwork, switchNetwork, networks, shelbyClient } = useSolanaNetwork();
  const cluster = useClientStore((s) => s.cluster);
  
  const solanaConnected = solanaStatus === "connected";
  const solanaPublicKey = wallet?.account?.address;
  
  const { storageAccountAddress, signAndSubmitTransaction: solanaSignAndSubmitTransaction } = useStorageAccount({
    client: shelbyClient,
    wallet: solanaConnected ? wallet : null,
  });
  
  const { mutateAsync: uploadBlobs, isPending: isUploading } = useUploadBlobs({
    client: shelbyClient,
  });
  
  const [walletType, setWalletType] = useState(null);
  const [file, setFile] = useState(null);
  const [blobName, setBlobName] = useState('');
  const [expirationDays, setExpirationDays] = useState(365);
  const [privacyLevel, setPrivacyLevel] = useState('public');
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadData, setUploadData] = useState(null);
  const [uploadStep, setUploadStep] = useState('prepare');
  const [uploadCompleted, setUploadCompleted] = useState(false);
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);
  const [aptBalance, setAptBalance] = useState(null);
  const [shelbyUsdBalance, setShelbyUsdBalance] = useState(null);
  const [faucetLoading, setFaucetLoading] = useState(false);

  const isConnected = connected || solanaConnected;
  const currentAccount = connected ? account : { publicKey: solanaPublicKey };

  const handleSolanaFaucet = async () => {
    if (!solanaConnected) {
      showMessage('Please connect your Solana wallet first', 'error');
      return;
    }

    if (!storageAccountAddress) {
      showMessage('Storage account address not available', 'error');
      return;
    }

    setFaucetLoading(true);

    try {
      const storageAddressStr = storageAccountAddress.toString();
      const results = { shelbyUsd: false, apt: false };

      await Promise.all([
        shelbyClient.fundAccountWithShelbyUSD({
          address: storageAddressStr,
          amount: 1_000_000_000,
        }).then(() => {
          results.shelbyUsd = true;
        }).catch((error) => {
        }),
        shelbyClient.fundAccountWithAPT({
          address: storageAddressStr,
          amount: 1_000_000_000,
        }).then(() => {
          results.apt = true;
        }).catch((error) => {
        })
      ]);

      let successCount = 0;
      if (results.shelbyUsd) successCount++;
      if (results.apt) successCount++;

      if (successCount > 0) {
        showMessage(`Faucet requested successfully! ${successCount}/2 tokens claimed`, 'success');
      } else {
        showMessage('Faucet request failed for all tokens', 'error');
      }
    } catch (error) {
      showMessage('Failed to request Solana faucet: ' + error.message, 'error');
    } finally {
      setFaucetLoading(false);
    }
  };

  const handleAptosFaucet = async () => {
    if (!connected || !account) {
      showMessage('Please connect your Aptos wallet first', 'error');
      return;
    }

    setFaucetLoading(true);

    try {
      const response = await fetch('https://faucet.shelbynet.shelby.xyz/fund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: parseAddress(account.address),
          amount: 1000000000
        })
      });

      if (response.ok) {
        showMessage('Successfully claimed ShelbyUSD', 'success');
      } else {
        const errorData = await response.json();
        showMessage(`Failed to claim: ${errorData.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      showMessage('Failed to claim ShelbyUSD', 'error');
    } finally {
      setFaucetLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setBlobName(selectedFile.name);
    }
  };

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleSolanaUpload = async (e) => {
    e.preventDefault();
    
    if (!solanaConnected) {
      showMessage('Please connect your Solana wallet first', 'error');
      return;
    }

    if (!file) {
      showMessage('Please select a file to upload', 'error');
      return;
    }

    setShowNetworkWarning(true);
  };

  const confirmSolanaUpload = async () => {
    setShowNetworkWarning(false);
    setLoading(true);
    setUploadStatus('Preparing Solana upload...');

    try {
      let currentUploadData = uploadData;
      
      if (!currentUploadData) {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const fileData = new Uint8Array(arrayBuffer);
        const uniqueBlobName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${blobName}`;
        const fileSize = file.size;
        const expirationMicros = (Date.now() + expirationDays * 24 * 60 * 60 * 1000) * 1000;
        
        let parsedAddress = null;
        
        if (solanaConnected && solanaPublicKey) {
          try {
            const { SolanaDerivedPublicKey } = await import('@aptos-labs/derived-wallet-solana');
            const defaultSolanaAuthenticationFunction = '0x1::solana_derivable_account::authenticate';
            const domain = 'shelby';
            
            let solanaKeyObject;
            if (typeof solanaPublicKey === 'string') {
              solanaKeyObject = {
                toBase58: () => solanaPublicKey
              };
            } else if (solanaPublicKey && typeof solanaPublicKey === 'object') {
              if (typeof solanaPublicKey.toBase58 === 'function') {
                solanaKeyObject = solanaPublicKey;
              } else if (typeof solanaPublicKey.toString === 'function') {
                solanaKeyObject = {
                  toBase58: () => solanaPublicKey.toString()
                };
              } else {
                throw new Error('Invalid Solana public key format');
              }
            } else {
              throw new Error('No valid Solana account found');
            }
            
            const derivedPublicKey = new SolanaDerivedPublicKey({
              domain,
              solanaPublicKey: solanaKeyObject,
              authenticationFunction: defaultSolanaAuthenticationFunction
            });
            
            parsedAddress = derivedPublicKey.authKey().derivedAddress().toString();
          } catch (error) {
            console.error('Failed to derive storage address:', error);
          }
        }
        
        currentUploadData = {
          fileData,
          uniqueBlobName,
          fileSize,
          expirationMicros,
          parsedAddress
        };
      }

      let attempts = 0;
      const maxAttempts = 10;
      const retryDelay = 1000;

      while (!storageAccountAddress || !solanaSignAndSubmitTransaction) {
        attempts++;
        if (attempts > maxAttempts) {
          setUploadStatus('');
          showMessage('Storage account initialization timed out. Please refresh and try again.', 'error');
          setLoading(false);
          return;
        }
        setUploadStatus(`Waiting for storage account... (${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
      
      if (!solanaPublicKey) {
        setUploadStatus('');
        showMessage('Please connect your Solana wallet first', 'error');
        setLoading(false);
        return;
      }

      setUploadStatus('Storage account ready. Preparing upload...');

      const expirationMicros = (Date.now() + expirationDays * 24 * 60 * 60 * 1000) * 1000;

      const blobData = currentUploadData.fileData instanceof Uint8Array 
        ? currentUploadData.fileData 
        : new Uint8Array(currentUploadData.fileData);

      setUploadStatus('Uploading blob...');

      try {
        let signerAccount = storageAccountAddress;
        
        if (currentUploadData.parsedAddress) {
          signerAccount = currentUploadData.parsedAddress;
        }
        
        await uploadBlobs({
          signer: {
            account: signerAccount,
            signAndSubmitTransaction: solanaSignAndSubmitTransaction,
          },
          blobs: [
            {
              blobName: currentUploadData.uniqueBlobName,
              blobData,
            },
          ],
          expirationMicros,
        });

        const blobUrl = `https://api.shelbynet.shelby.xyz/shelby/v1/blobs/${signerAccount.toString()}/${currentUploadData.uniqueBlobName}`;

        setUploadStatus('Blob uploaded successfully!');
        showMessage(`File uploaded successfully! URL: ${blobUrl}`, 'success');
        setUploadCompleted(true);
        setUploadStep('prepare');
        setFile(null);
        setBlobName('');
        setUploadData(null);
        setLoading(false);
        return;
      } catch (error) {
        let errorMessage = 'Unknown error';
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error instanceof Error && error.message) {
          errorMessage = error.message;
        } else if (error.toString) {
          errorMessage = error.toString();
        }
        
        setUploadStatus('');
        if (errorMessage && (errorMessage.includes('User rejected') || 
                 errorMessage.includes('Cancel') || 
                 errorMessage.includes('cancelled') ||
                 errorMessage.includes('rejected') ||
                 errorMessage.includes('cancel') ||
                 errorMessage.includes('CANCELED') ||
                 errorMessage.includes('USER_REJECTED'))) {
          showMessage('Transaction cancelled by user', 'info');
          setUploadStep('prepare');
        } else {
          showMessage('Upload failed: ' + errorMessage, 'error');
          setUploadStep('prepare');
        }
        setLoading(false);
        return;
      }
    } catch (error) {
      setUploadStatus('');
      showMessage('Failed to upload file: ' + error.message, 'error');
      setLoading(false);
    }
  };

  const handlePrepareUpload = async (e) => {
    e.preventDefault();
    if (!connected && !solanaConnected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }
    if (!connected && !solanaPublicKey) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }

    if (!file) {
      showMessage('Please select a file to upload', 'error');
      return;
    }

    setLoading(true);
    setUploadStatus('Preparing upload...');

    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const fileData = new Uint8Array(arrayBuffer);

      const SHELBY_API_KEY = import.meta.env.VITE_SHELBY_API_KEY || '';
      const SHELBY_BEARER_TOKEN = import.meta.env.VITE_SHELBY_BEARER_TOKEN || '';

      if (!SHELBY_API_KEY || !SHELBY_BEARER_TOKEN) {
        throw new Error('API keys are not available');
      }

      const moduleAddress = import.meta.env.VITE_SHELBY_MODULE_ADDRESS || "0xc63d6a5efb0080a6029403131715bd4971e1149f7cc099aac69bb0069b3ddbf5";

      let parsedAddress;
      if (connected && account) {
        setWalletType('aptos');
        parsedAddress = parseAddress(account.address);
        
        try {
          const aptos = initAptosClient();
          await aptos.account.getModule({ 
            accountAddress: moduleAddress, 
            moduleName: "blob_metadata"
          });
        } catch (error) {
        }

        try {
          const aptos = initAptosClient();
          await aptos.transactions.getGasPriceEstimate();
        } catch (error) {
        }

        try {
          const aptos = initAptosClient();
          await aptos.account.getAccountInfo({ 
            accountAddress: account.address 
          });
        } catch (error) {
        }
      } else if (solanaConnected) {
        setWalletType('solana');
        const currentAccount = solanaPublicKey;
        if (!currentAccount) {
          throw new Error('No Solana account found');
        }
        
        try {
          const { SolanaDerivedPublicKey } = await import('@aptos-labs/derived-wallet-solana');
          const defaultSolanaAuthenticationFunction = '0x1::solana_derivable_account::authenticate';
          const domain = 'shelby';
          
          let solanaKeyObject;
          if (typeof currentAccount === 'string') {
            solanaKeyObject = {
              toBase58: () => currentAccount
            };
          } else if (currentAccount && typeof currentAccount === 'object') {
            if (typeof currentAccount.toBase58 === 'function') {
              solanaKeyObject = currentAccount;
            } else if (typeof currentAccount.toString === 'function') {
              solanaKeyObject = {
                toBase58: () => currentAccount.toString()
              };
            } else {
              throw new Error('Invalid Solana public key format');
            }
          } else {
            throw new Error('No valid Solana account found');
          }
          
          const derivedPublicKey = new SolanaDerivedPublicKey({
            domain,
            solanaPublicKey: solanaKeyObject,
            authenticationFunction: defaultSolanaAuthenticationFunction
          });
          
          parsedAddress = derivedPublicKey.authKey().derivedAddress().toString();
        } catch (error) {
          throw new Error('Failed to derive storage address: ' + error.message);
        }
      }
      
      if (!parsedAddress) {
        throw new Error('Could not parse account address');
      }

      const uniqueBlobName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${blobName}`;
      const fileSize = file.size;
      const expirationMicros = (Date.now() + expirationDays * 24 * 60 * 60 * 1000) * 1000;

      const uploadDataObj = {
        parsedAddress,
        uniqueBlobName,
        fileSize,
        fileData,
        expirationMicros,
        moduleAddress,
        privacyLevel
      };

      setUploadData(uploadDataObj);

      if (solanaConnected) {
        await handleSolanaUpload(e);
        return;
      }

      setUploadStep('upload');
      setUploadStatus('');
    } catch (error) {
      setUploadStatus('');
      showMessage('Failed to prepare upload: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!connected && !solanaConnected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }
    if (!connected && !solanaPublicKey) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }

    if (!file) {
      showMessage('Please select a file to upload', 'error');
      return;
    }

    setLoading(true);
    
    try {
      const currentUploadData = uploadData;

      const SHELBY_API_KEY = import.meta.env.VITE_SHELBY_API_KEY || '';
      const SHELBY_BEARER_TOKEN = import.meta.env.VITE_SHELBY_BEARER_TOKEN || '';

      if (!SHELBY_API_KEY || !SHELBY_BEARER_TOKEN) {
        throw new Error('API keys are not available');
      }

      if (walletType === 'solana') {
        setUploadStatus('Preparing Solana upload...');
        
        let attempts = 0;
        const maxAttempts = 5;
        const retryDelay = 1000;

        while (!storageAccountAddress || !solanaSignAndSubmitTransaction) {
          attempts++;
          if (attempts > maxAttempts) {
            setUploadStatus('');
            showMessage('Storage account initialization timed out. Please refresh and try again.', 'error');
            setLoading(false);
            return;
          }
          setUploadStatus(`Waiting for storage account... (${attempts}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        if (!solanaPublicKey) {
          setUploadStatus('');
          showMessage('Please connect your Solana wallet first', 'error');
          setLoading(false);
          return;
        }

        setUploadStatus('Storage account ready. Preparing upload...');

        const expirationMicros = (Date.now() + expirationDays * 24 * 60 * 60 * 1000) * 1000;

        const blobData = currentUploadData.fileData instanceof Uint8Array 
          ? currentUploadData.fileData 
          : new Uint8Array(currentUploadData.fileData);

        setUploadStatus('Uploading blob...');

        try {
          let signerAccount = storageAccountAddress;
          
          if (currentUploadData.parsedAddress) {
            signerAccount = currentUploadData.parsedAddress;
          }
          
          await uploadBlobs({
            signer: {
              account: signerAccount,
              signAndSubmitTransaction: solanaSignAndSubmitTransaction,
            },
            blobs: [
              {
                blobName: currentUploadData.uniqueBlobName,
                blobData,
              },
            ],
            expirationMicros,
          });

          const blobUrl = `https://api.shelbynet.shelby.xyz/shelby/v1/blobs/${signerAccount.toString()}/${currentUploadData.uniqueBlobName}`;

          setUploadStatus('Blob uploaded successfully!');
          showMessage(`File uploaded successfully! URL: ${blobUrl}`, 'success');
          setUploadCompleted(true);
          setUploadStep('prepare');
          setFile(null);
          setBlobName('');
          setUploadData(null);
          setLoading(false);
          return;
        } catch (error) {
          let errorMessage = 'Unknown error';
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error instanceof Error && error.message) {
            errorMessage = error.message;
          } else if (error.toString) {
            errorMessage = error.toString();
          }
          
          setUploadStatus('');
          if (errorMessage && (errorMessage.includes('User rejected') || 
                   errorMessage.includes('Cancel') || 
                   errorMessage.includes('cancelled') ||
                   errorMessage.includes('rejected') ||
                   errorMessage.includes('cancel') ||
                   errorMessage.includes('CANCELED') ||
                   errorMessage.includes('USER_REJECTED'))) {
            showMessage('Transaction cancelled by user', 'info');
            setUploadStep('upload');
          } else {
            showMessage('Upload failed: ' + errorMessage, 'error');
            setUploadStep('upload');
          }
          setLoading(false);
          return;
        }
      } else if (walletType === 'aptos') {
        setUploadStatus('Uploading file...');

        const { ClayErasureCodingProvider, generateCommitments } = await import("@shelby-protocol/sdk/browser");

        const provider = await ClayErasureCodingProvider.create();

        const blobCommitments = await generateCommitments(provider, currentUploadData.fileData);

        const blobMerkleRootHex = blobCommitments.blob_merkle_root;
        
        const cleanHex = blobMerkleRootHex.startsWith('0x') ? blobMerkleRootHex.slice(2) : blobMerkleRootHex;
        
        if (cleanHex.length !== 64) {
          throw new Error(`Invalid blob_merkle_root length: expected 64 hex characters, got ${cleanHex.length}`);
        }
        
        const blobMerkleRootBytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          blobMerkleRootBytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
        }

        const calculateNumChunksets = (fileSize, chunkSize = 5 * 1024 * 1024) => {
          if (fileSize <= 0) return 1;
          return Math.ceil(fileSize / chunkSize);
        };

        const getPermissionValue = (privacyLevel) => {
          switch(privacyLevel) {
            case 'private':
              return "2";
            case 'public':
            default:
              return "0";
          }
        };

        const numChunksets = calculateNumChunksets(currentUploadData.fileSize);
        const permissionValue = getPermissionValue(currentUploadData.privacyLevel);

        let txResponse;
        const transactionPayload = {
          sender: currentUploadData.parsedAddress,
          data: {
            function: `${currentUploadData.moduleAddress}::blob_metadata::register_multiple_blobs`,
            functionArguments: [
              [currentUploadData.uniqueBlobName],
              currentUploadData.expirationMicros,
              [Array.from(blobMerkleRootBytes)],
              [numChunksets],
              [currentUploadData.fileSize],
              parseInt(permissionValue),
              0
            ]
          }
        };

        try {
          if (!signAndSubmitTransaction || typeof signAndSubmitTransaction !== 'function') {
            throw new Error('signAndSubmitTransaction function is not available');
          }
          txResponse = await signAndSubmitTransaction(transactionPayload);

          if (!txResponse || !txResponse.hash) {
            setUploadStatus('');
            showMessage('Transaction submission failed: No hash returned', 'error');
            setLoading(false);
            return;
          }

          setUploadStatus('Submitting transaction...');
        } catch (error) {

          if (!error) {
            setUploadStatus('');
            showMessage('Transaction verification failed: No error information available', 'error');
            setUploadStep('upload');
            setLoading(false);
            return;
          }

          let errorMessage = 'Unknown error';
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error instanceof Error && error.message) {
            errorMessage = error.message;
          } else if (error.toString) {
            errorMessage = error.toString();
          }
          
          setUploadStatus('');
          if (errorMessage && errorMessage.includes('The specified blob was not found')) {
            setUploadStatus('Preparing upload...');
          } else if (errorMessage && (errorMessage.includes('User rejected') || 
                   errorMessage.includes('Cancel') || 
                   errorMessage.includes('cancelled') ||
                   errorMessage.includes('rejected') ||
                   errorMessage.includes('cancel') ||
                   errorMessage.includes('CANCELED') ||
                   errorMessage.includes('USER_REJECTED'))) {
            showMessage('Transaction cancelled by user', 'info');
            setUploadStep('upload');
          } else {
            showMessage('Transaction verification failed: ' + errorMessage, 'error');
            setUploadStep('upload');
          }
          setLoading(false);
          return;
        }

        setUploadStatus('Verifying transaction...');

        const transactionUrl = `${getShelbyFullnodeUrl()}/transactions/by_hash/${txResponse.hash}`;

        const transactionResponse = await fetch(transactionUrl, {
          method: 'GET',
          headers: {
            'X-Shelby-Api-Key': SHELBY_API_KEY
          }
        });

        if (!transactionResponse.ok) {
          const errorData = await transactionResponse.text();
          setUploadStatus('');
          showMessage(`Transaction verification failed: ${transactionResponse.status} ${transactionResponse.statusText} - ${errorData}`, 'error');
          setLoading(false);
          return;
        }

        await transactionResponse.json();

        setUploadStatus('Waiting for transaction...');

        try {
          const aptos = initAptosClient();
          await aptos.waitForTransaction({
            transactionHash: txResponse.hash,
            options: {
              waitForIndexer: true
            }
          });
        } catch (error) {
          setUploadStatus('');
          showMessage('Error waiting for transaction: ' + error.message, 'error');
          setLoading(false);
          return;
        }

        const { ShelbyClient } = await import("@shelby-protocol/sdk/browser");

        const shelbyClient = new ShelbyClient({
          network: Network.SHELBYNET,
          apiKey: SHELBY_BEARER_TOKEN
        });

        const blobData = currentUploadData.fileData instanceof Uint8Array 
          ? currentUploadData.fileData 
          : new Uint8Array(currentUploadData.fileData);

        const account = AccountAddress.from(currentUploadData.parsedAddress);
        const blobName = currentUploadData.uniqueBlobName;
        const partSize = 5 * 1024 * 1024;

        const baseUrl = shelbyClient.baseUrl;
        
        const startUrl = new URL("/shelby/v1/multipart-uploads", baseUrl).toString();

        const startResponse = await fetch(startUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SHELBY_BEARER_TOKEN}`
          },
          body: JSON.stringify({
            rawAccount: account.toString(),
            rawBlobName: blobName,
            rawPartSize: partSize
          })
        });

        let responseBody = '';
        try {
          responseBody = await startResponse.text();
        } catch (error) {
        }

        if (!startResponse.ok) {
          throw new Error(`Failed to start multipart upload! status: ${startResponse.status}, body: ${responseBody}`);
        }

        let uploadId;
        try {
          const responseData = JSON.parse(responseBody);
          uploadId = responseData.uploadId;
        } catch (error) {
          throw new Error(`Failed to parse response: ${error.message}, response: ${responseBody}`);
        }
        
        const totalParts = Math.ceil(blobData.length / partSize);

        for (let partIdx = 0; partIdx < totalParts; partIdx++) {
          const start = partIdx * partSize;
          const end = Math.min(start + partSize, blobData.length);
          const partData = blobData.slice(start, end);

          const partUrl = new URL(`/shelby/v1/multipart-uploads/${uploadId}/parts/${partIdx}`, baseUrl).toString();
          const partResponse = await fetch(partUrl, {
            method: "PUT",
            headers: {
              "Content-Type": "application/octet-stream",
              "Authorization": `Bearer ${SHELBY_BEARER_TOKEN}`
            },
            body: partData
          });

          if (!partResponse.ok) {
            throw new Error(`Failed to upload part ${partIdx}! status: ${partResponse.status}`);
          }
        }

        const completeUrl = new URL(`/shelby/v1/multipart-uploads/${uploadId}/complete`, baseUrl).toString();
        
        let completeResponseBody = '';
        const completeResponse = await fetch(completeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SHELBY_BEARER_TOKEN}`
          }
        });
        
        try {
          completeResponseBody = await completeResponse.text();
        } catch (error) {
        }

        if (!completeResponse.ok) {
          throw new Error(`Failed to complete multipart upload! status: ${completeResponse.status}, body: ${completeResponseBody}`);
        }

        setUploadStatus('');

        setFile(null);
        setBlobName('');
        setExpirationDays(365);
        setUploadData(null);
        setUploadStep('prepare');
        setUploadCompleted(true);
      }
    } catch (error) {
      setUploadStatus('');
      showMessage('Failed to upload file: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const initAptosClient = () => {
    const fullnodeUrl = getShelbyFullnodeUrl();
    const indexerUrl = import.meta.env.VITE_SHELBY_INDEXER || "https://api.shelbynet.shelby.xyz/v1/graphql";

    const config = new AptosConfig({
    network: AptosNetwork.CUSTOM,
    fullnode: fullnodeUrl,
    indexer: indexerUrl,
    chainId: 109
  });

    return new Aptos(config);
  };

  const getShelbyFullnodeUrl = () => {
    return import.meta.env.VITE_SHELBY_FULLNODE || "https://api.shelbynet.shelby.xyz/v1";
  };

  const getShelbyApiUrl = () => {
    const apiUrl = import.meta.env.VITE_SHELBY_API_URL || "https://api.shelbynet.shelby.xyz";
    return `${apiUrl}/shelby/v1`;
  };

  const parseAddress = (address) => {
    if (!address) return null;

    let addrStr;

    if (typeof address === 'string') {
      addrStr = address;
    } else if (address.data && Array.isArray(address.data)) {
      const hex = address.data.map(byte => byte.toString(16).padStart(2, '0')).join('');
      addrStr = `0x${hex}`;
    } else if (typeof address.toString === 'function') {
      addrStr = address.toString();
    } else {
      addrStr = JSON.stringify(address);
    }

    return addrStr;
  };

  const buildRequestUrl = (endpoint, baseUrl) => {
    const url = new URL(endpoint, baseUrl);
    return url.toString();
  };

  const getAccountBalance = async () => {
    let parsedAddress;
    
    if (connected && account && account.address) {
      parsedAddress = parseAddress(account.address);
    } else if (solanaConnected && storageAccountAddress) {
      parsedAddress = storageAccountAddress.toString();
    } else {
      return;
    }
    
    if (!parsedAddress) {
      return;
    }
    
    try {
      const aptos = initAptosClient();
      
      setAptBalance('0');
      setShelbyUsdBalance('0');
      
      try {
        const aptAmount = await aptos.getAccountAPTAmount({
          accountAddress: parsedAddress
        });
        
        const aptBalanceStr = aptAmount.toString();
        setAptBalance(aptBalanceStr);
      } catch (aptError) {
      }
      
      try {
        const coinsData = await aptos.getAccountCoinsData({
          accountAddress: parsedAddress,
          options: {
            limit: 10
          }
        });
        
        if (Array.isArray(coinsData)) {
          for (const coin of coinsData) {
            if (coin && coin.asset_type) {
              const isShelbyUSD = (
                coin.asset_type.includes('shelby') || 
                coin.asset_type.includes('Shelby') ||
                (coin.metadata && (coin.metadata.symbol === 'SHELBY_USD' || coin.metadata.name === 'ShelbyUSD'))
              );
              
              if (isShelbyUSD) {
                if (coin.amount) {
                  const shelbyUsdBalanceStr = coin.amount.toString();
                  setShelbyUsdBalance(shelbyUsdBalanceStr);
                }
              }
            }
          }
        }
      } catch (coinsDataError) {
      }
      
      try {
        const ownedTokens = await aptos.getAccountOwnedTokens({
          accountAddress: parsedAddress,
          options: {
            tokenStandard: 'v2',
            limit: 10
          }
        });
        
        if (Array.isArray(ownedTokens)) {
          for (const token of ownedTokens) {
            if (token && token.metadata) {
              if (token.metadata.symbol === 'SHELBY_USD' || token.metadata.name === 'ShelbyUSD') {
                if (token.amount) {
                  const shelbyUsdBalanceStr = token.amount.toString();
                  setShelbyUsdBalance(shelbyUsdBalanceStr);
                }
              }
            }
          }
        }
      } catch (ownedTokensError) {
      }
    } catch (error) {
      setAptBalance('0');
      setShelbyUsdBalance('0');
    }
  };

  const withRetry = async (fn, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  useEffect(() => {
    if (uploadCompleted && (connected || solanaConnected)) {
      getAccountBalance();
    }
  }, [uploadCompleted, connected, account, solanaConnected]);

  useEffect(() => {
    if (connected || solanaConnected) {
      getAccountBalance();
    }
  }, [connected, account, solanaConnected]);



  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-center space-x-6">
            <div className="p-3 bg-blue-100 rounded-full animate-pulse">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 object-cover rounded-full" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4 animate-fade-in">Shelby File Upload</h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">Upload files to the Shelby network with ease</p>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-8 transform transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Upload Files</h2>
            </div>
            

            
            {uploadStep === 'prepare' && !uploadCompleted && (
              <form onSubmit={handlePrepareUpload} className="space-y-6">
                <div>
                  <label htmlFor="file" className="block text-gray-700 font-medium mb-2">
                    File
                    <div className="inline-flex ml-4 space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="privacyLevel"
                          value="public"
                          checked={privacyLevel === 'public'}
                          onChange={(e) => setPrivacyLevel(e.target.value)}
                          className="form-radio h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2 text-sm text-gray-700">Public</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="privacyLevel"
                          value="private"
                          checked={privacyLevel === 'private'}
                          onChange={(e) => setPrivacyLevel(e.target.value)}
                          className="form-radio h-4 w-4 text-blue-600"
                          disabled
                        />
                        <span className="ml-2 text-sm text-gray-400">Private (Coming Soon)</span>
                      </label>
                    </div>
                  </label>
                  <input
                    type="file"
                    id="file"
                    className="w-full px-4 py-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    onChange={handleFileChange}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="blobName" className="block text-gray-700 font-medium mb-2">Blob Name</label>
                  <input
                    type="text"
                    id="blobName"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    value={blobName}
                    onChange={(e) => setBlobName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="expirationDays" className="block text-gray-700 font-medium mb-2">Expiration Days</label>
                  <select
                    id="expirationDays"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    value={expirationDays}
                    onChange={(e) => setExpirationDays(parseInt(e.target.value))}
                    required
                  >
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                    <option value="365">365 Days</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:from-purple-700 hover:to-purple-800 transform hover:-translate-y-1 flex items-center justify-center"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042.133 6.042 3.273 8.98.538.536 1.36.536 1.898 0C8.105 17.318 12 12 12 12z"></path>
                      </svg>
                      {uploadStatus || 'Uploading...'}
                    </>
                  ) : (
                    'Upload File'
                  )}
                </button>
              </form>
            )}
            
            {uploadStep === 'upload' && !uploadCompleted && (
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h3 className="text-lg font-medium text-blue-800 mb-2">Upload Details</h3>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600"><span className="font-medium">File:</span> {uploadData?.fileSize} bytes</p>
                    <p className="text-sm text-gray-600"><span className="font-medium">Blob Name:</span> {uploadData?.uniqueBlobName}</p>
                    <p className="text-sm text-gray-600"><span className="font-medium">Privacy Level:</span> {uploadData?.privacyLevel === 'private' ? 'Private' : 'Public'}</p>
                    <p className="text-sm text-gray-600"><span className="font-medium">Upload Time:</span> {new Date().toLocaleString('en-US')}</p>
                  </div>
                </div>

                <form onSubmit={handleUpload} className="space-y-6">
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:from-purple-700 hover:to-purple-800 transform hover:-translate-y-1 flex items-center justify-center"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H2c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {uploadStatus || 'Uploading...'}
                      </>
                    ) : (
                      'Upload File'
                    )}
                  </button>
                </form>

                <button
                  onClick={() => {
                    setUploadStep('prepare');
                    setUploadData(null);
                  }}
                  className="w-full bg-gradient-to-r from-gray-600 to-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:from-gray-700 hover:to-gray-800 transform hover:-translate-y-1"
                >
                  Back to Prepare Upload
                </button>
              </div>
            )}
            
            {uploadCompleted && (
              <div className="text-center py-12 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-100">
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Upload Completed</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">Your file has been successfully uploaded to Shelby network</p>
                <button
                  onClick={() => setUploadCompleted(false)}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg transition-all duration-300 hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transform hover:-translate-y-1"
                >
                  Upload Another File
                </button>
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-8 transform transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Wallet Information</h2>
            </div>
            
            {(connected && account) || (solanaConnected && solanaPublicKey) ? (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm">
                      <div className="space-y-3">
                        <div className="flex items-center p-3 rounded-lg bg-white">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <div className="flex justify-between items-center w-full">
                            <span className="text-sm font-medium text-gray-700">{connected ? 'APT Address' : 'SOL Address'}</span>
                            <span 
                              className="text-sm font-medium text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
                              onClick={() => {
                                let address;
                                if (connected && account && parseAddress(account.address)) {
                                  address = parseAddress(account.address);
                                } else if (solanaConnected && solanaPublicKey) {
                                  address = solanaPublicKey.toString();
                                }
                                if (address) {
                                  navigator.clipboard.writeText(address);
                                  showMessage('Address copied to clipboard!', 'success');
                                }
                              }}
                            >
                              {connected && account ? (
                                parseAddress(account.address) ? `${parseAddress(account.address).slice(0, 6)}...${parseAddress(account.address).slice(-4)}` : 'Invalid Address'
                              ) : (
                                solanaPublicKey ? `${solanaPublicKey.toString().slice(0, 6)}...${solanaPublicKey.toString().slice(-4)}` : 'Unknown Address'
                              )}
                            </span>
                          </div>
                        </div>
                        {!connected && solanaConnected === true && (
                          <div className="flex items-center p-3 rounded-lg bg-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <div className="flex justify-between items-center w-full">
                              <span className="text-sm font-medium text-gray-700">Shelby Derived Address</span>
                              <span 
                                className="text-sm font-medium text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => {
                                  if (storageAccountAddress) {
                                    navigator.clipboard.writeText(storageAccountAddress.toString());
                                    showMessage('Shelby Storage Address copied to clipboard!', 'success');
                                  }
                                }}
                              >
                                {storageAccountAddress ? `${storageAccountAddress.toString().slice(0, 6)}...${storageAccountAddress.toString().slice(-4)}` : 'Not available'}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center p-3 rounded-lg bg-white">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                          </svg>
                          <div className="flex justify-between items-center w-full">
                            <span className="text-sm font-medium text-gray-700">Network</span>
                            <div className="flex items-center overflow-visible">
                              {connected && (
                                network?.name === 'custom' ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-600 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-red-600 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                )
                              )}
                              {solanaConnected && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-red-600 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                              <span className="text-sm font-medium text-gray-800">
                                {connected ? (network?.name === 'custom' ? 'shelbynet' : network?.name || 'Unknown Network') : (solanaConnected ? 'Please switch to Solana Devnet' : 'Not Connected')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center p-3 rounded-lg bg-white">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex justify-between items-center w-full">
                            <span className="text-sm font-medium text-gray-700">APT Balance</span>
                            <span className="text-sm font-medium text-gray-800">
                              {(connected || solanaConnected) ? (aptBalance ? `${(parseInt(aptBalance) / 100000000).toFixed(4)}` : 'Loading...') : 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center p-3 rounded-lg bg-white">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex justify-between items-center w-full">
                            <span className="text-sm font-medium text-gray-700">ShelbyUSD Balance</span>
                            <span className="text-sm font-medium text-gray-800">
                              {(connected || solanaConnected) ? (shelbyUsdBalance ? `${(parseInt(shelbyUsdBalance) / 100000000).toFixed(4)}` : 'Loading...') : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                
                <div className="space-y-3">
                  {connected && account ? (
                    <>
                      <button 
                        onClick={() => handleAptosFaucet()}
                        className="block bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-between w-full"
                      >
                        <span>Claim ShelbyUSD</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                        </svg>
                      </button>
                      <a 
                        href={`https://docs.shelby.xyz/apis/faucet/aptos?address=${parseAddress(account.address)}`} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-green-50 hover:bg-green-100 text-green-700 font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-between"
                      >
                        <span>Claim APT</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                        </svg>
                      </a>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSolanaFaucet}
                        disabled={faucetLoading}
                        className="block bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-between"
                      >
                        <span>Claim ShelbyUSD & APT</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="flex justify-center mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">No Wallet Connected</h3>
                <p className="text-gray-600 mb-4">Please connect your wallet to see account information</p>
              </div>
            )}
          </div>
        </main>

        <footer className="bg-white rounded-xl shadow-lg p-8 text-center">
          <p className="text-gray-600">© 2026 Shelby Upload Tool | Built with Shelby Protocol</p>
          <div className="mt-4">
            <a 
              href="https://github.com/wuya51/shelby-upload-tool" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path>
              </svg>
              <span>GitHub Repository</span>
            </a>
          </div>
        </footer>
      </div>
      
      {showNetworkWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">Network Warning</h3>
            </div>
            <p className="text-gray-700 mb-6">Please switch to Solana Devnet before uploading files. Your wallet must be connected to Solana Devnet to use this application.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowNetworkWarning(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmSolanaUpload}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Confirm Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const { connect, disconnect, connected, account, wallets, network, signAndSubmitTransaction } = useAptosWallet();
  const { wallet: solanaWallet, status: solanaStatus, connectors: solanaConnectors, connect: solanaConnect, disconnect: solanaDisconnect } = useWalletConnection();
  
  const solanaConnected = solanaStatus === "connected";
  const solanaPublicKey = solanaWallet?.account?.address;
  
  const [walletType, setWalletType] = useState(null); // 'aptos' or 'solana'
  const [showConnectMenu, setShowConnectMenu] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const isHoveringButtonRef = useRef(false);
  const isHoveringMenuRef = useRef(false);
  const menuTimerRef = useRef(null);
  const [walletState, setWalletState] = useState(0);
  
  useEffect(() => {
    setWalletState(prev => prev + 1);
  }, [solanaWallet]);

  const showMessage = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('info');
    }, 5000);
  };

  const parseAddress = (address) => {
    if (!address) return null;
    if (typeof address === 'string') return address;
    if (address.data && Array.isArray(address.data)) {
      const hex = address.data.map(byte => byte.toString(16).padStart(2, '0')).join('');
      return `0x${hex}`;
    }
    if (typeof address.toString === 'function') {
      return address.toString();
    }
    return JSON.stringify(address);
  };

  const handleConnect = async (walletName) => {
    try {
      await connect(walletName);
      setShowConnectMenu(false);
    } catch (error) {
    }
  };

  const handleButtonMouseEnter = () => {
    isHoveringButtonRef.current = true;
    if (menuTimerRef.current) {
      clearTimeout(menuTimerRef.current);
      menuTimerRef.current = null;
    }
  };

  const handleButtonMouseLeave = () => {
    isHoveringButtonRef.current = false;
    setTimeout(() => {
      if (!isHoveringButtonRef.current && !isHoveringMenuRef.current) {
        setShowConnectMenu(false);
      }
    }, 200);
  };

  const checkPhantomWallet = () => {
    return typeof window !== 'undefined' && window.solana && window.solana.isPhantom;
  };

  const handleMenuMouseEnter = () => {
    isHoveringMenuRef.current = true;
    if (menuTimerRef.current) {
      clearTimeout(menuTimerRef.current);
      menuTimerRef.current = null;
    }
  };

  const handleMenuMouseLeave = () => {
    isHoveringMenuRef.current = false;
    setTimeout(() => {
      if (!isHoveringButtonRef.current && !isHoveringMenuRef.current) {
        setShowConnectMenu(false);
      }
    }, 200);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showConnectMenu) {
        setShowConnectMenu(false);
        if (menuTimerRef.current) {
          clearTimeout(menuTimerRef.current);
          menuTimerRef.current = null;
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      if (menuTimerRef.current) {
        clearTimeout(menuTimerRef.current);
        menuTimerRef.current = null;
      }
    };
  }, [showConnectMenu]);

  useEffect(() => {
    if (showConnectMenu) {
      if (menuTimerRef.current) {
        clearTimeout(menuTimerRef.current);
        menuTimerRef.current = null;
      }
      menuTimerRef.current = setTimeout(() => {
        setShowConnectMenu(false);
        menuTimerRef.current = null;
      }, 3000);
    }
    return () => {
      if (menuTimerRef.current) {
        clearTimeout(menuTimerRef.current);
        menuTimerRef.current = null;
      }
    };
  }, [showConnectMenu]);

  const withRetry = async (fn, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <nav className="bg-white shadow-md relative">
            <div className="max-w-4xl mx-auto px-4 overflow-visible">
              <div className="flex justify-between min-h-16 overflow-visible">
                <div className="flex items-center flex-1">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full overflow-hidden mr-2">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-cover rounded-full" />
                      </div>
                      <span className="font-bold text-xl text-gray-900 whitespace-nowrap hidden sm:inline">Shelby Upload Tool</span>
                    </div>
                    <div className="flex space-x-4">
                    <Link 
                      to="/" 
                      className="text-gray-700 hover:text-blue-600 inline-flex items-center px-3 py-2 border-b-2 border-transparent hover:border-blue-500 text-sm font-medium transition-colors duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="hidden md:inline">Upload</span>
                    </Link>
                    <Link 
                      to="/blobs" 
                      className="text-gray-700 hover:text-blue-600 inline-flex items-center px-3 py-2 border-b-2 border-transparent hover:border-blue-500 text-sm font-medium transition-colors duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="hidden md:inline">My Blobs</span>
                    </Link>
                    </div>
                  </div>
                </div>
                <div className="flex items-center overflow-visible relative">
                  {connected ? (
                    <button
                      onClick={disconnect}
                      className="bg-gradient-to-r from-green-600 to-green-700 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-300 hover:shadow-lg hover:from-green-700 hover:to-green-800 transform hover:-translate-y-1"
                    >
                      <span className="text-sm font-mono">
                        {account?.address ? (
                          (() => {
                            const parsedAddress = parseAddress(account.address);
                            return parsedAddress ? `${parsedAddress.slice(0, 6)}...${parsedAddress.slice(-4)}` : 'Invalid Address';
                          })()
                        ) : 'Unknown Address'}
                      </span>
                      <span className="text-xs bg-green-800 px-2 py-0.5 rounded-full">APT</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  ) : solanaConnected ? (
                    <button
                      onClick={solanaDisconnect}
                      className="bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-300 hover:shadow-lg hover:from-purple-700 hover:to-purple-800 transform hover:-translate-y-1"
                    >
                      <span className="text-sm font-mono">
                        {solanaPublicKey ? (
                          `${solanaPublicKey.toString().slice(0, 6)}...${solanaPublicKey.toString().slice(-4)}`
                        ) : 'Unknown Address'}
                      </span>
                      <span className="text-xs bg-purple-800 px-2 py-0.5 rounded-full">SOL</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  ) : (
                    <div className="relative overflow-visible">
                      <button 
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg flex items-center space-x-2 transition-all duration-300 hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transform hover:-translate-y-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowConnectMenu(!showConnectMenu);
                        }}
                        onMouseEnter={handleButtonMouseEnter}
                        onMouseLeave={handleButtonMouseLeave}
                      >
                        <span>Connect Wallet</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showConnectMenu && (
                        <div 
                          className="absolute right-0 top-full mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 md:w-56 z-50"
                          onMouseEnter={handleMenuMouseEnter}
                          onMouseLeave={handleMenuMouseLeave}
                        >
                          <div className="py-2">
                            <div className="px-4 py-2 border-b border-gray-700">
                              <p className="text-xs font-semibold text-gray-400 uppercase">Aptos Wallets</p>
                            </div>
                            {wallets.filter(wallet => !wallet.name.toLowerCase().includes('google') && !wallet.name.toLowerCase().includes('apple') && !wallet.name.toLowerCase().includes('okx')).length === 0 ? (
                              <div className="px-4 py-6 text-center">
                                <p className="text-sm text-gray-400 mb-4">No Aptos wallets detected</p>
                                <a 
                                  href="https://petra.app/" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                                >
                                  Install Petra Wallet
                                </a>
                              </div>
                            ) : (
                              <div className="px-4 py-4 space-y-2">
                                {wallets.map((wallet) => {
                                  if (wallet.name.toLowerCase().includes('google') || wallet.name.toLowerCase().includes('apple') || wallet.name.toLowerCase().includes('okx')) {
                                    return null;
                                  }
                                return (
                                  <button
                                    key={wallet.name}
                                    onClick={() => handleConnect(wallet.name)}
                                    className="block w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 transition-colors rounded-lg"
                                  >
                                    <div className="flex items-center space-x-3">
                                      <div className="w-6 h-6 rounded-full overflow-hidden">
                                        <img src={wallet.icon} alt={wallet.name} className="w-full h-full object-cover" />
                                      </div>
                                      <span>{wallet.name}</span>
                                    </div>
                                  </button>
                                );
                              })}
                              </div>
                            )}
                            
                            <div className="px-4 py-2 border-b border-gray-700">
                              <p className="text-xs font-semibold text-gray-400 uppercase">Solana Wallets</p>
                            </div>
                            <div className="px-4 py-4 space-y-2">
                              {solanaConnectors.filter(connector => !connector.name.toLowerCase().includes('okx') && !connector.name.toLowerCase().includes('bina')).map((connector) => (
                                <button
                                  key={connector.id}
                                  onClick={async () => {
                                    await solanaConnect(connector.id);
                                    setShowConnectMenu(false);
                                  }}
                                  className="block w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 transition-colors rounded-lg"
                                >
                                  <div className="flex items-center space-x-3">
                                    <div className="w-6 h-6 rounded-full overflow-hidden">
                                      <img src={connector.icon} alt={connector.name} className="w-full h-full object-cover" />
                                    </div>
                                    <span>{connector.name}</span>
                                  </div>
                                </button>
                              ))}
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </nav>

          <main>
            <Routes>
              <Route path="/" element={
                <UploadPage 
                  signAndSubmitTransaction={signAndSubmitTransaction || (() => Promise.reject(new Error('signAndSubmitTransaction is not available')))} 
                  showMessage={showMessage} 
                /> 
              } />
              <Route path="/blobs" element={<Blobs />} />
            </Routes>
          </main>
          
          {message && (
            <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-md ${messageType === 'error' ? 'bg-red-50 border border-red-200 text-red-800' : messageType === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-blue-50 border border-blue-200 text-blue-800'}`}>
              {message}
            </div>
          )}
        </div>
      </Router>
  );
}

export default App;