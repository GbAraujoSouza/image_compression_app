import numpy as np
import io
from PIL import Image
from fastapi import UploadFile


def load_img_into_numpy(file: UploadFile) -> np.ndarray:
    """Load an uploaded image file into a NumPy array."""
    image = Image.open(file.file)
    return np.array(image)


def numpy_to_bytes(img_array: np.ndarray, format: str = "PNG") -> bytes:
    """Convert a NumPy array image to bytes."""
    image = Image.fromarray(img_array.astype("uint8"))
    byte_io = io.BytesIO()
    image.save(byte_io, format=format)
    return byte_io.getvalue()


def compress_channel_svd(channel: np.ndarray, k: int) -> np.ndarray:

    U, S, VT = np.linalg.svd(channel, full_matrices=False)

    s_k = np.diag(S[:k])
    u_k = U[:, :k]
    vt_k = VT[:k, :]

    compressed = u_k @ s_k @ vt_k
    compressed = np.clip(compressed, 0, 255)

    return compressed.astype(np.uint8)
