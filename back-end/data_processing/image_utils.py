import numpy as np
import io
from PIL import Image
from fastapi import UploadFile
import matplotlib.cm as cm


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

    k = min(k, len(S))

    s_k = np.diag(S[:k])
    u_k = U[:, :k]
    vt_k = VT[:k, :]

    compressed = u_k @ s_k @ vt_k
    compressed = np.clip(compressed, 0, 255)

    return compressed.astype(np.uint8)


def compress_full_image(img_np: np.ndarray, k: int) -> np.ndarray:
    """Função síncrona que faz toda a compressão (roda na worker thread)."""
    # Garante RGB
    if img_np.ndim == 2:  # grayscale
        img_np = np.stack([img_np, img_np, img_np], axis=2)

    R, G, B = img_np[:, :, 0], img_np[:, :, 1], img_np[:, :, 2]

    r_compressed = compress_channel_svd(R, k)
    g_compressed = compress_channel_svd(G, k)
    b_compressed = compress_channel_svd(B, k)

    out = np.stack([r_compressed, g_compressed, b_compressed], axis=2)
    return out.astype("uint8")


def compress_image_with_region(img_np, k_region, k_base, region, tile_size=128):
    print(
        f"compress_image_with_region: k_region={k_region}, k_base={k_base}, region={region}"
    )
    h, w = img_np.shape[:2]
    R, G, B = img_np[:, :, 0], img_np[:, :, 1], img_np[:, :, 2]

    r_out = np.zeros_like(R)
    g_out = np.zeros_like(G)
    b_out = np.zeros_like(B)

    for y in range(0, h, tile_size):
        for x in range(0, w, tile_size):

            tile_x2 = min(x + tile_size, w)
            tile_y2 = min(y + tile_size, h)

            inside = not (
                region["x2"] < x
                or region["x1"] > tile_x2
                or region["y2"] < y
                or region["y1"] > tile_y2
            )

            # Dentro da região usa k_region (alta resolução)
            # Fora da região usa k_base (baixa resolução)
            k_tile = k_region if inside else k_base

            r_tile = R[y:tile_y2, x:tile_x2]
            g_tile = G[y:tile_y2, x:tile_x2]
            b_tile = B[y:tile_y2, x:tile_x2]

            r_out[y:tile_y2, x:tile_x2] = compress_channel_svd(r_tile, k_tile)
            g_out[y:tile_y2, x:tile_x2] = compress_channel_svd(g_tile, k_tile)
            b_out[y:tile_y2, x:tile_x2] = compress_channel_svd(b_tile, k_tile)

    return np.stack([r_out, g_out, b_out], axis=2)


def compress_image_with_region_global(img_np, k_region, k_base, region):
    h, w = img_np.shape[:2]

    R, G, B = img_np[:, :, 0], img_np[:, :, 1], img_np[:, :, 2]

    # Máscara 2D
    M = np.zeros((h, w), dtype=float)
    x1, y1, x2, y2 = region["x1"], region["y1"], region["x2"], region["y2"]
    M[y1:y2, x1:x2] = 1.0

    def mix_channel(channel):
        # SVD global
        U, S, VT = np.linalg.svd(channel, full_matrices=False)

        k_base_eff = min(k_base, len(S))
        k_region_eff = min(k_region, len(S))

        # baixa resolução
        a_low = U[:, :k_base_eff] @ np.diag(S[:k_base_eff]) @ VT[:k_base_eff, :]

        # alta resolução
        a_high = U[:, :k_region_eff] @ np.diag(S[:k_region_eff]) @ VT[:k_region_eff, :]

        # mistura
        out = a_low * (1 - M) + a_high * M
        return np.clip(out, 0, 255).astype(np.uint8)

    r_out = mix_channel(R)
    g_out = mix_channel(G)
    b_out = mix_channel(B)

    return np.stack([r_out, g_out, b_out], axis=2)


def compute_error_map(original_np: np.ndarray, compressed_np: np.ndarray):
    # Erro absoluto médio entre canais
    error = np.mean(
        np.abs(original_np.astype(float) - compressed_np.astype(float)), axis=2
    )

    # Normalizar para [0, 1]
    error_norm = error / np.max(error + 1e-8)

    # Aplicar colormap Inferno
    inferno = cm.get_cmap("inferno")
    heatmap = inferno(error_norm)[:, :, :3]  # descartar alpha

    heatmap_uint8 = (heatmap * 255).astype(np.uint8)
    return heatmap_uint8
