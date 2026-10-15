"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import {
  useCloudDriveConnection,
  useCloudDriveFiles,
  useCreateCloudDriveFolder,
  useDisconnectCloudDrive,
  useStartCloudDriveOAuth,
  useUpdateCloudDriveConnection,
  useUpdateCloudDriveFile,
  useUploadCloudDriveFile,
  type CloudDriveFileItem,
  type CloudDriveProvider,
} from "@/hooks/useCloudDrive";

type CloudDriveAppPageProps = {
  provider: CloudDriveProvider;
  i18nPrefix: "googleDrive" | "oneDrive";
};

function formatBytes(size?: number): string {
  if (size === undefined || Number.isNaN(size)) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] ?? "" : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function CloudDriveAppPage({ provider, i18nPrefix }: CloudDriveAppPageProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const { data, isLoading, isError, error } = useCloudDriveConnection(provider);
  const startOAuth = useStartCloudDriveOAuth(provider);
  const updateMutation = useUpdateCloudDriveConnection(provider);
  const disconnectMutation = useDisconnectCloudDrive(provider);
  const uploadMutation = useUploadCloudDriveFile(provider);
  const createFolderMutation = useCreateCloudDriveFolder(provider);
  const updateFileMutation = useUpdateCloudDriveFile(provider);

  const [enabled, setEnabled] = useState(false);
  const [formError, setFormError] = useState("");
  const [oauthMessage, setOauthMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [replacingFileId, setReplacingFileId] = useState<string | null>(null);

  const currentFolderId = folderStack[folderStack.length - 1]?.id;
  const connected = Boolean(data?.connected);

  const filesQuery = useCloudDriveFiles(provider, {
    folderId: currentFolderId,
    query: query || undefined,
    enabled: connected,
  });

  useEffect(() => {
    if (!data) return;
    setEnabled(Boolean(data.enabled));
  }, [data]);

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setOauthMessage(t(`${i18nPrefix}.connectedSuccess`));
    }
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setOauthMessage(decodeURIComponent(oauthError));
    }
  }, [searchParams, t, i18nPrefix]);

  const files = useMemo(() => filesQuery.data?.files ?? [], [filesQuery.data?.files]);

  async function handleConnect() {
    setFormError("");
    try {
      const result = await startOAuth.mutateAsync();
      window.location.href = result.authUrl;
    } catch (connectError) {
      setFormError(
        connectError instanceof Error ? connectError.message : t(`${i18nPrefix}.connectError`)
      );
    }
  }

  async function handleSave() {
    setFormError("");
    setSaved(false);
    try {
      await updateMutation.mutateAsync({ enabled });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t(`${i18nPrefix}.saveError`));
    }
  }

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setFormError("");
    try {
      const contentBase64 = await fileToBase64(file);
      await uploadMutation.mutateAsync({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        contentBase64,
        ...(currentFolderId ? { parentId: currentFolderId } : {}),
      });
    } catch (uploadError) {
      setFormError(
        uploadError instanceof Error ? uploadError.message : t(`${i18nPrefix}.uploadError`)
      );
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setFormError("");
    try {
      await createFolderMutation.mutateAsync({
        name,
        ...(currentFolderId ? { parentId: currentFolderId } : {}),
      });
      setNewFolderName("");
    } catch (folderError) {
      setFormError(
        folderError instanceof Error ? folderError.message : t(`${i18nPrefix}.folderError`)
      );
    }
  }

  async function handleRename(fileId: string) {
    const name = renameValue.trim();
    if (!name) return;
    setFormError("");
    try {
      await updateFileMutation.mutateAsync({ fileId, name });
      setRenamingFileId(null);
      setRenameValue("");
    } catch (renameError) {
      setFormError(
        renameError instanceof Error ? renameError.message : t(`${i18nPrefix}.renameError`)
      );
    }
  }

  async function handleReplaceContent(fileId: string, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setFormError("");
    setReplacingFileId(fileId);
    try {
      const contentBase64 = await fileToBase64(file);
      await updateFileMutation.mutateAsync({
        fileId,
        contentBase64,
        mimeType: file.type || "application/octet-stream",
      });
    } catch (replaceError) {
      setFormError(
        replaceError instanceof Error ? replaceError.message : t(`${i18nPrefix}.replaceError`)
      );
    } finally {
      setReplacingFileId(null);
    }
  }

  function openFolder(file: CloudDriveFileItem) {
    if (!file.isFolder) return;
    setQuery("");
    setSearchInput("");
    setFolderStack((current) => [...current, { id: file.id, name: file.name }]);
  }

  if (isLoading) {
    return (
      <DashboardPage>
        <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />
      </DashboardPage>
    );
  }

  if (isError) {
    return (
      <DashboardPage>
        <Alert variant="danger">
          {error instanceof Error ? error.message : t(`${i18nPrefix}.loadError`)}
        </Alert>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <PageHeader title={t(`${i18nPrefix}.title`)} subtitle={t(`${i18nPrefix}.subtitle`)} />

      <div className="mb-4">
        <Link href="/apps" className="text-sm font-medium text-accent hover:text-accent-hover">
          {t(`${i18nPrefix}.backToApps`)}
        </Link>
      </div>

      {oauthMessage ? (
        <Alert
          variant={searchParams.get("connected") === "1" ? "success" : "danger"}
          className="mb-4"
        >
          {oauthMessage}
        </Alert>
      ) : null}
      {formError ? (
        <Alert variant="danger" className="mb-4">
          {formError}
        </Alert>
      ) : null}
      {saved ? (
        <Alert variant="success" className="mb-4">
          {t(`${i18nPrefix}.saved`)}
        </Alert>
      ) : null}

      <section className="mb-6 space-y-4 rounded-xl border border-default bg-surface-elevated p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-primary">
              {t(`${i18nPrefix}.connectionTitle`)}
            </h2>
            <p className="mt-1 text-sm text-secondary">{t(`${i18nPrefix}.connectionHint`)}</p>
          </div>
          <Badge variant={connected ? "success" : "default"}>
            {connected
              ? t(`${i18nPrefix}.statusConnected`)
              : t(`${i18nPrefix}.statusDisconnected`)}
          </Badge>
        </div>

        {!connected ? (
          <Button onClick={handleConnect} disabled={startOAuth.isPending}>
            {t(`${i18nPrefix}.connect`)}
          </Button>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-primary">
              {t(`${i18nPrefix}.connectedAccount`, {
                account: data?.accountEmail ?? data?.displayName ?? "—",
              })}
            </p>
            <Button variant="secondary" onClick={() => setConfirmDisconnect(true)}>
              {t(`${i18nPrefix}.disconnect`)}
            </Button>
          </div>
        )}
      </section>

      {connected ? (
        <section className="mb-6 space-y-4 rounded-xl border border-default bg-surface-elevated p-6">
          <h2 className="text-base font-semibold text-primary">
            {t(`${i18nPrefix}.settingsTitle`)}
          </h2>
          <label className="flex items-center gap-2 text-sm text-primary">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            {t(`${i18nPrefix}.enabled`)}
          </label>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {t(`${i18nPrefix}.save`)}
          </Button>
        </section>
      ) : null}

      {connected ? (
        <section className="space-y-4 rounded-xl border border-default bg-surface-elevated p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-primary">
              {t(`${i18nPrefix}.filesTitle`)}
            </h2>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
                {t(`${i18nPrefix}.upload`)}
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    void handleUpload(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={folderStack.length === 0 && !query}
              onClick={() => {
                setQuery("");
                setSearchInput("");
                setFolderStack((current) => current.slice(0, -1));
              }}
            >
              {t(`${i18nPrefix}.up`)}
            </Button>
            <div className="flex flex-1 flex-wrap gap-2">
              <Input
                className="min-w-[180px] flex-1"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t(`${i18nPrefix}.searchPlaceholder`)}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  setFolderStack([]);
                  setQuery(searchInput.trim());
                }}
              >
                {t(`${i18nPrefix}.search`)}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[180px] flex-1"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder={t(`${i18nPrefix}.folderNamePlaceholder`)}
            />
            <Button
              variant="secondary"
              disabled={createFolderMutation.isPending || !newFolderName.trim()}
              onClick={() => void handleCreateFolder()}
            >
              {t(`${i18nPrefix}.createFolder`)}
            </Button>
          </div>

          {folderStack.length > 0 ? (
            <p className="text-sm text-secondary">
              {t(`${i18nPrefix}.path`)}:{" "}
              {folderStack.map((folder) => folder.name).join(" / ")}
            </p>
          ) : null}

          {filesQuery.isLoading ? (
            <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
          ) : files.length === 0 ? (
            <p className="text-sm text-secondary">{t(`${i18nPrefix}.filesEmpty`)}</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-default">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      className={`truncate font-medium text-left ${
                        file.isFolder
                          ? "text-accent hover:text-accent-hover"
                          : "text-primary cursor-default"
                      }`}
                      onClick={() => openFolder(file)}
                      disabled={!file.isFolder}
                    >
                      {file.isFolder ? `[${t(`${i18nPrefix}.folder`)}] ` : ""}
                      {file.name}
                    </button>
                    <p className="mt-1 text-secondary">
                      {formatBytes(file.size)}
                      {file.modifiedAt
                        ? ` · ${new Date(file.modifiedAt).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {renamingFileId === file.id ? (
                      <>
                        <Input
                          className="w-40"
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                        />
                        <Button
                          variant="secondary"
                          disabled={updateFileMutation.isPending || !renameValue.trim()}
                          onClick={() => void handleRename(file.id)}
                        >
                          {t(`${i18nPrefix}.saveRename`)}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setRenamingFileId(null);
                            setRenameValue("");
                          }}
                        >
                          {t(`${i18nPrefix}.cancel`)}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setRenamingFileId(file.id);
                          setRenameValue(file.name);
                        }}
                      >
                        {t(`${i18nPrefix}.rename`)}
                      </Button>
                    )}
                    {!file.isFolder ? (
                      <label className="inline-flex cursor-pointer rounded-lg border border-default px-3 py-2 text-sm font-medium text-primary hover:bg-surface-muted">
                        {replacingFileId === file.id
                          ? t(`${i18nPrefix}.replacing`)
                          : t(`${i18nPrefix}.replace`)}
                        <input
                          type="file"
                          className="hidden"
                          disabled={updateFileMutation.isPending}
                          onChange={(event) => {
                            void handleReplaceContent(file.id, event.target.files);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    ) : null}
                    {file.webUrl ? (
                      <a
                        href={file.webUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-accent hover:text-accent-hover"
                      >
                        {t(`${i18nPrefix}.openLink`)}
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmDisconnect}
        title={t(`${i18nPrefix}.disconnectTitle`)}
        description={t(`${i18nPrefix}.disconnectDescription`)}
        confirmLabel={t(`${i18nPrefix}.disconnect`)}
        onConfirm={async () => {
          setConfirmDisconnect(false);
          try {
            await disconnectMutation.mutateAsync();
            setFolderStack([]);
            setQuery("");
            setSearchInput("");
          } catch (disconnectError) {
            setFormError(
              disconnectError instanceof Error
                ? disconnectError.message
                : t(`${i18nPrefix}.disconnectError`)
            );
          }
        }}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </DashboardPage>
  );
}
