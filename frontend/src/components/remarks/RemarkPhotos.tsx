import { useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { remarkApi } from "@/api/remarkService"
import { Button } from "@/components/ui/button"
import { Camera, Loader2, Maximize2 } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import imageCompression from 'browser-image-compression'

interface RemarkPhotosProps {
    remarkId: string;
}

export function RemarkPhotos({ remarkId }: RemarkPhotosProps) {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState<string | null>(null)

    const { data: photos = [], isLoading } = useQuery({
        queryKey: ['remark-photos', remarkId],
        queryFn: () => remarkApi.getPhotos(remarkId),
        enabled: !!remarkId,
    })

    const uploadPhotoMutation = useMutation({
        mutationFn: async (file: File) => {
            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1280,
                useWebWorker: true,
                initialQuality: 0.8
            }
            const compressedFile = await imageCompression(file, options)
            const formData = new FormData()
            formData.append("photo", compressedFile, compressedFile.name)
            return remarkApi.uploadPhoto(remarkId, formData)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remark-photos', remarkId] })
            toast.success("Фото прикреплено")
        },
        onError: () => toast.error("Ошибка при загрузке фото")
    })

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        uploadPhotoMutation.mutate(file)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                    <Camera className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Фотографии ({photos.length})</span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadPhotoMutation.isPending}
                    className="bg-white border-slate-200 hover:bg-slate-50 rounded-lg gap-2 text-[10px] font-bold uppercase py-1 h-8"
                >
                    {uploadPhotoMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                    Добавить фото
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                />
            </div>

            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Array(4).fill(0).map((_, i) => (
                        <Skeleton key={i} className="aspect-square rounded-xl bg-slate-100" />
                    ))}
                </div>
            ) : photos.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Нет прикрепленных фото</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {photos.map((photo) => (
                        <div 
                            key={photo.id} 
                            className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 border border-slate-200 cursor-pointer"
                            onClick={() => setIsPreviewOpen(photo.photo_url)}
                        >
                            <img
                                src={photo.photo_url}
                                alt="Remark photo"
                                className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Maximize2 className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Simpler Full-screen Preview Modal */}
            {isPreviewOpen && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
                    onClick={() => setIsPreviewOpen(null)}
                >
                    <img 
                        src={isPreviewOpen} 
                        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl animate-in zoom-in duration-300" 
                        alt="Zoomed" 
                    />
                    <Button 
                        variant="link" 
                        className="absolute top-8 right-8 text-white/50 hover:text-white font-black uppercase tracking-[0.2em] text-[10px]"
                    >
                        Закрыть (Esc)
                    </Button>
                </div>
            )}
        </div>
    )
}
