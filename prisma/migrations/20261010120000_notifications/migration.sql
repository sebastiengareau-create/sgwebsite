-- Notifications pour différentes raisons : historique des avis (cloche) et
-- types d'avis coupés par chaque employé.
ALTER TABLE "User" ADD COLUMN "notificationsCoupees" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "corps" TEXT,
    "url" TEXT,
    "lue" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_employeId_creeLe_idx" ON "Notification"("employeId", "creeLe");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
