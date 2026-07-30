import { useEffect, useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import FileIcon from '../../components/ui/FileIcon'
import Icon from '../../components/ui/Icon'
import { useAuth } from '../../hooks/useAuth'
import { useCategories } from '../../hooks/useDocuments'
import { useToast } from '../../context/ToastContext'
import { sendUploadNotification } from '../../lib/adminApi'
import { supabase, DOCUMENTS_BUCKET } from '../../lib/supabase'
import { formatFileSize, sanitizeFileName } from '../../lib/format'

const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg']
const ACCEPT_ATTR = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'
const MAX_BYTES = 50 * 1024 * 1024

function isAccepted(file) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ACCEPTED_EXTENSIONS.includes(ext)
}

export default function Upload() {
  const { user } = useAuth()
  const { categories } = useCategories()
  const toast = useToast()
  const fileInputRef = useRef(null)

  const [companies, setCompanies] = useState([])
  const [companyId, setCompanyId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dragging, setDragging] = useState(false)

  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true
    supabase
      .from('companies')
      .select('id, name')
      .order('name')
      .then(({ data, error }) => {
        if (!active) return
        if (error) setFormError(error.message)
        else setCompanies(data || [])
      })
    return () => {
      active = false
    }
  }, [])

  function selectFile(nextFile) {
    if (!nextFile) return
    if (!isAccepted(nextFile)) {
      setErrors((prev) => ({
        ...prev,
        file: 'Accepted file types: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG.',
      }))
      return
    }
    if (nextFile.size > MAX_BYTES) {
      setErrors((prev) => ({ ...prev, file: 'Files must be 50 MB or smaller.' }))
      return
    }
    setErrors((prev) => ({ ...prev, file: undefined }))
    setFile(nextFile)
    // Pre-fill the document name from the file name, minus its extension.
    if (!name.trim()) setName(nextFile.name.replace(/\.[^.]+$/, ''))
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    selectFile(e.dataTransfer.files?.[0])
  }

  function resetForm({ keepCompany = true } = {}) {
    setFile(null)
    setName('')
    setDescription('')
    setCategoryId('')
    if (!keepCompany) setCompanyId('')
    setProgress(0)
    setProgressLabel('')
    setErrors({})
    setFormError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    const next = {}
    if (!companyId) next.companyId = 'Choose the client company this document belongs to.'
    if (!file) next.file = 'Select a file to upload.'
    if (!name.trim()) next.name = 'Document name is required.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setUploading(true)
    setDone(false)
    const filePath = `${companyId}/${Date.now()}-${sanitizeFileName(file.name)}`

    try {
      setProgress(15)
      setProgressLabel('Uploading file…')

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        })
      if (uploadError) throw uploadError

      setProgress(60)
      setProgressLabel('Saving document details…')

      const { data: inserted, error: insertError } = await supabase
        .from('documents')
        .insert({
          company_id: companyId,
          category_id: categoryId || null,
          name: name.trim(),
          description: description.trim() || null,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || null,
          uploaded_by: user?.id ?? null,
        })
        .select('id')
        .single()

      if (insertError) {
        // Do not leave an orphaned object behind in storage.
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([filePath])
        throw insertError
      }

      setProgress(85)
      setProgressLabel('Notifying the client…')

      const { error: notificationError } = await supabase.from('notifications').insert({
        company_id: companyId,
        document_id: inserted.id,
        title: 'New document available',
        message: `${name.trim()} has been added to your portal.`,
      })
      if (notificationError) throw notificationError

      // Email is a nicety — a failure here must not fail the upload.
      try {
        await sendUploadNotification({ documentId: inserted.id })
      } catch {
        toast.info('Document uploaded. The email alert could not be sent.')
      }

      setProgress(100)
      setProgressLabel('Done')
      setDone(true)
      toast.success('Document uploaded.')
      resetForm()
    } catch (err) {
      setFormError(err.message || 'Upload failed. Please try again.')
      setProgress(0)
      setProgressLabel('')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Upload Document</h1>
        <p className="subhead">Share a document with one of your client companies.</p>
      </div>

      <div className="card form-narrow">
        {formError && <div className="form-error">{formError}</div>}
        {done && (
          <div className="form-success">
            Document uploaded successfully. You can upload another below.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="upload-company">Company *</label>
            <select
              id="upload-company"
              className="select"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              aria-invalid={Boolean(errors.companyId)}
            >
              <option value="">Select a company…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.companyId && <span className="field-error">{errors.companyId}</span>}
          </div>

          <div className="field">
            <label htmlFor="upload-category">Category</label>
            <select
              id="upload-category"
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>File *</span>
            {file ? (
              <div className="file-chip">
                <FileIcon fileName={file.name} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="doc-name" style={{ fontSize: '0.92rem' }}>
                    {file.name}
                  </div>
                  <div className="small muted">{formatFileSize(file.size)}</div>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => {
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  aria-label="Remove selected file"
                  disabled={uploading}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
            ) : (
              <div
                className={`dropzone${dragging ? ' dragging' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <div className="dz-icon">
                  <Icon name="upload" size={30} strokeWidth={1.6} />
                </div>
                <div>
                  <strong>Click to choose a file</strong> or drag it here
                </div>
                <div className="small">PDF, DOCX, XLSX, PNG, JPG — up to 50 MB</div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="sr-only"
              onChange={(e) => selectFile(e.target.files?.[0])}
            />
            {errors.file && <span className="field-error">{errors.file}</span>}
          </div>

          <div className="field">
            <label htmlFor="upload-name">Document name *</label>
            <input
              id="upload-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="field">
            <label htmlFor="upload-description">Description</label>
            <textarea
              id="upload-description"
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note for the client."
            />
          </div>

          {uploading && (
            <div style={{ marginBottom: '1rem' }}>
              <div className="small muted">{progressLabel}</div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <Button type="submit" loading={uploading}>
            <Icon name="upload" size={16} />
            Upload Document
          </Button>
        </form>
      </div>
    </>
  )
}
