import { useState } from "react";

/**
 * Hook personalizado para manejo de carga de archivos
 * Integración con el nuevo endpoint /files/upload
 */

export interface UploadResponse {
  file_id: string;
  filename: string;
  stored_filename: string;
  content_type: string;
  file_size: number;
  download_url: string;
}

export const useFileUpload = (token: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<UploadResponse | null>(null);

  const uploadFile = async (
    file: File,
    description?: string
  ): Promise<UploadResponse | null> => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (description) {
        formData.append("description", description);
      }

      const response = await fetch("/api/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error al subir archivo");
      }

      const data: UploadResponse = await response.json();
      setSuccess(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (fileId: string, originalFilename?: string) => {
    // Crear un link temporal para descargar
    const link = document.createElement("a");
    link.href = `/api/files/download/${fileId}`;
    link.download = originalFilename || `archivo-${fileId}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteFile = async (fileId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/files/delete/${fileId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error al eliminar archivo");
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      return false;
    }
  };

  return {
    uploadFile,
    downloadFile,
    deleteFile,
    loading,
    error,
    success,
  };
};

/**
 * Componente de carga de archivos
 * Uso:
 *
 * <FileUploadForm
 *   token={authToken}
 *   onSuccess={(file) => console.log("Archivo subido:", file)}
 * />
 */

interface FileUploadFormProps {
  token: string;
  onSuccess?: (file: UploadResponse) => void;
  onError?: (error: string) => void;
  accept?: string;
  maxSizeMB?: number;
}

export const FileUploadForm: React.FC<FileUploadFormProps> = ({
  token,
  onSuccess,
  onError,
  accept = "image/*,application/pdf,.xlsx,.xls,.csv,.zip",
  maxSizeMB = 5,
}) => {
  const { uploadFile, loading, error, success } = useFileUpload(token);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamaño
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        onError?.(
          `El archivo supera el límite de ${maxSizeMB}MB (tamaño: ${sizeMB.toFixed(2)}MB)`
        );
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    const result = await uploadFile(selectedFile, description);
    if (result) {
      setSelectedFile(null);
      setDescription("");
      onSuccess?.(result);
    } else if (error) {
      onError?.(error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Seleccionar archivo</label>
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Descripción (opcional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
          placeholder="Describe el contenido del archivo..."
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded">
          ✅ Archivo "{success.filename}" subido exitosamente
          <br />
          <small>ID: {success.file_id}</small>
        </div>
      )}

      <button
        type="submit"
        disabled={!selectedFile || loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-400"
      >
        {loading ? "Subiendo..." : "Subir archivo"}
      </button>
    </form>
  );
};

/**
 * Componente para mostrar lista de archivos descargables
 */

interface FileListProps {
  fileIds: string[];
  filenames: string[];
  token: string;
  onDelete?: (fileId: string) => void;
  canDelete?: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  fileIds,
  filenames,
  token,
  onDelete,
  canDelete = true,
}) => {
  const { deleteFile, downloadFile } = useFileUpload(token);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (fileId: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este archivo?")) {
      setDeleting(fileId);
      const success = await deleteFile(fileId);
      if (success) {
        onDelete?.(fileId);
      }
      setDeleting(null);
    }
  };

  if (!fileIds.length) {
    return <p className="text-gray-500">No hay archivos</p>;
  }

  return (
    <div className="space-y-2">
      {fileIds.map((fileId, idx) => (
        <div
          key={fileId}
          className="flex items-center justify-between p-3 bg-gray-50 rounded border"
        >
          <span className="flex-1">{filenames[idx]}</span>
          <div className="space-x-2">
            <button
              onClick={() => downloadFile(fileId, filenames[idx])}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
            >
              Descargar
            </button>
            {canDelete && (
              <button
                onClick={() => handleDelete(fileId)}
                disabled={deleting === fileId}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm disabled:bg-gray-400"
              >
                {deleting === fileId ? "Eliminando..." : "Eliminar"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Ejemplo de uso en un componente:
 *
 * function MiComponente() {
 *   const { token } = useAuth();
 *   const [archivos, setArchivos] = useState<string[]>([]);
 *
 *   return (
 *     <div>
 *       <FileUploadForm
 *         token={token}
 *         onSuccess={(file) => {
 *           setArchivos([...archivos, file.file_id]);
 *         }}
 *       />
 *
 *       <FileList
 *         fileIds={archivos}
 *         filenames={archivos}
 *         token={token}
 *         onDelete={(fileId) => {
 *           setArchivos(archivos.filter(id => id !== fileId));
 *         }}
 *       />
 *     </div>
 *   );
 * }
 */
