import React from "react";
import equal from "react-fast-compare"
import { CMSType, Entity, ResolvedProperty } from "../../../../types";
import { PropertyPreview } from "../../../../preview";

import { getPreviewSizeFrom } from "../../../../preview/util";
import { TableCell } from "../../Table/TableCell";
import { useEntityCollectionTableController } from "../EntityCollectionTable";
import { getRowHeight } from "../../Table/common";
import { getValueInPath } from "../../../util";

export interface PropertyPreviewTableCellProps<T extends CMSType, M extends Record<string, any>> {
    propertyKey: string;
    columnIndex: number;
    align: "right" | "left" | "center";
    property: ResolvedProperty<T>;
    width: number;
    entity: Entity<M>;
}

export const PropertyPreviewTableCell = React.memo<PropertyPreviewTableCellProps<any, any>>(
    function PropertyPreviewTableCell<T extends CMSType, M extends Record<string, any>>({
                                                                 propertyKey,
                                                                 columnIndex,
                                                                 property,
                                                                 align,
                                                                 width,
                                                                 entity
                                                             }: PropertyPreviewTableCellProps<T, M>) {

        const {
            size,
            focused
        } = useEntityCollectionTableController();

        const value = getValueInPath(entity.values, propertyKey);
        return (
            <TableCell
                size={size}
                width={width}
                focused={focused}
                key={`preview_cell_${propertyKey}_${entity.id}`}
                value={value}
                align={align ?? "left"}
                disabled={true}>
                <PropertyPreview
                    width={width}
                    height={getRowHeight(size)}
                    propertyKey={propertyKey}
                    property={property }
                    entity={entity}
                    value={value}
                    size={getPreviewSizeFrom(size)}
                />
            </TableCell>
        );

    },
    equal) as React.FunctionComponent<PropertyPreviewTableCellProps<any, any>>;
