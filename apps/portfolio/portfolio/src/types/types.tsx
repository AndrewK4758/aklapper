import type { Dispatch, SetStateAction } from "react"

export type LoadingOutletContext = {
  loading: boolean,
  setLoading: Dispatch<SetStateAction<boolean>>
}