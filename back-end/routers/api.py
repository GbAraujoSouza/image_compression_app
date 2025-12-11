from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse
import numpy as np
from data_processing.image_utils import (
    compress_channel_svd,
    load_img_into_numpy,
    numpy_to_bytes,
)
from fastapi import UploadFile, File


router = APIRouter(tags=["api"])


@router.post("/upload-image/")
async def upload_image(file: UploadFile = File(...)):
    try:
        img_np = load_img_into_numpy(file)
        return JSONResponse(
            {
                "width": int(img_np.shape[1]),
                "height": int(img_np.shape[0]),
                "channels": int(img_np.shape[2]) if img_np.ndim == 3 else 1,
                "message": "Imagem recebida com sucesso!",
            }
        )

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)


@router.post("/compress")
async def compress_image(k: int, file: UploadFile = File(...)):

    img_np = load_img_into_numpy(file)

    R, G, B = img_np[:, :, 0], img_np[:, :, 1], img_np[:, :, 2]

    r_compressed = compress_channel_svd(R, k)
    g_compressed = compress_channel_svd(G, k)
    b_compressed = compress_channel_svd(B, k)

    img_np = np.stack((r_compressed, g_compressed, b_compressed), axis=2)
    out_bytes = numpy_to_bytes(img_np)

    return Response(content=out_bytes, media_type="image/png")
