-- CreateTable
CREATE TABLE "NotificationCedulee" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT,
    "heure" TEXT NOT NULL,
    "frequence" TEXT NOT NULL,
    "jours" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "date" TEXT,
    "tous" BOOLEAN NOT NULL DEFAULT false,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "employeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dernierEnvoi" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationCedulee_pkey" PRIMARY KEY ("id")
);
