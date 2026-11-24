<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules

- Every backend call goes through `apiFetch` in `src/lib/api.ts`, which routes to the in-browser sample pipeline or the live backend based on a stored mode. Pages must not call `fetch` directly. Why: the live pipeline address is not confirmed yet, and the app must stay fully clickable without it.
