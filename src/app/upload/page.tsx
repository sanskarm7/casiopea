'use client';

import { useState, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface UploadJob {
  id: string;
  file: File;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  garment?: any;
  error?: string;
}

export default function UploadPage() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    const newJobs: UploadJob[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'uploading' as const,
      progress: 0,
    }));

    setJobs((prev) => [...prev, ...newJobs]);

    // Process each file
    for (const job of newJobs) {
      try {
        await uploadFile(job);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
  };

  const uploadFile = async (job: UploadJob) => {
    try {
      // 1. Get presigned URL
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: job.file.name,
          content_type: job.file.type,
          size_bytes: job.file.size,
        }),
      });

      const { upload_id, upload_url, fields } = await presignRes.json();

      // 2. Upload directly to S3/R2
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      formData.append('file', job.file);

      await fetch(upload_url, {
        method: 'POST',
        body: formData,
      });

      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, progress: 50, status: 'processing' } : j
        )
      );

      // 3. Notify backend to start processing
      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_id,
          object_key: fields.key,
          checksum_sha256: upload_id, // Simplified for MVP
        }),
      });

      const { job_id } = await completeRes.json();

      // 4. Poll for completion
      await pollJobStatus(job, job_id);
    } catch (error: any) {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? { ...j, status: 'failed', error: error.message }
            : j
        )
      );
    }
  };

  const pollJobStatus = async (job: UploadJob, jobId: string) => {
    const maxAttempts = 60; // 60 seconds max
    let attempts = 0;

    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, status: 'failed', error: 'Processing timeout' }
              : j
          )
        );
        return;
      }

      attempts++;

      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();

        if (data.status === 'completed') {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? {
                    ...j,
                    status: 'completed',
                    progress: 100,
                    garment: data.result.garment,
                  }
                : j
            )
          );
        } else if (data.status === 'failed') {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? { ...j, status: 'failed', error: data.error }
                : j
            )
          );
        } else {
          // Still processing, poll again
          setTimeout(poll, 1000);
        }
      } catch (error: any) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, status: 'failed', error: error.message }
              : j
          )
        );
      }
    };

    await poll();
  };

  const removeJob = (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/" className="text-purple-600 hover:text-purple-700 mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold mb-2">Upload Wardrobe Items</h1>
          <p className="text-gray-600">
            Upload photos of your clothing items. Our AI will extract colors,
            detect categories, and make them searchable.
          </p>
        </div>

        {/* Upload Zone */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center mb-8 hover:border-purple-400 transition-colors cursor-pointer"
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-xl font-semibold mb-2">
            Drag & drop your images here
          </p>
          <p className="text-gray-500 mb-4">or click to browse</p>
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          <p className="text-sm text-gray-400">
            Supports: JPG, PNG, WebP • Max 10MB per file
          </p>
        </div>

        {/* Upload Progress */}
        {jobs.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">
              Processing ({jobs.filter((j) => j.status === 'completed').length}/
              {jobs.length} complete)
            </h2>

            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-lg shadow-lg p-4 flex items-center gap-4"
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {job.status === 'uploading' && (
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  )}
                  {job.status === 'processing' && (
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                  )}
                  {job.status === 'completed' && (
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  )}
                  {job.status === 'failed' && (
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{job.file.name}</p>
                  <p className="text-sm text-gray-500 capitalize">
                    {job.status}
                    {job.garment && ` • ${job.garment.category}`}
                    {job.error && ` • ${job.error}`}
                  </p>

                  {/* Progress Bar */}
                  {(job.status === 'uploading' || job.status === 'processing') && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Garment Details */}
                  {job.garment && (
                    <div className="mt-2 flex gap-2">
                      {job.garment.colors.slice(0, 5).map((color: any, idx: number) => (
                        <div
                          key={idx}
                          className="w-6 h-6 rounded-full border-2 border-white shadow"
                          style={{ backgroundColor: color.hex }}
                          title={`${Math.round(color.ratio * 100)}%`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeJob(job.id)}
                  className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            ))}

            {jobs.every((j) => j.status === 'completed') && (
              <Link
                href="/wardrobe"
                className="block text-center bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
              >
                View My Wardrobe
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

