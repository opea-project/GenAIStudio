// Copyright (C) 2024 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { ActionIcon, Button, Container, Drawer, FileInput, Loader, rem, Table, Text, TextInput } from '@mantine/core'
import { IconCheck, IconExclamationCircle, IconFileXFilled } from '@tabler/icons-react';
import { SyntheticEvent, useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../redux/store'
import { submitDataSourceURL, addFileDataSource, updateFileDataSourceStatus, uploadFile, fileDataSourcesSelector, FileDataSource, clearFileDataSources } from '../../redux/Conversation/ConversationSlice';
import { getCurrentTimeStamp, uuidv4 } from "../../common/util";
import client from "../../common/client";
import { DATA_PREP_URL } from "../../config";

type Props = {
  opened: boolean
  onClose: () => void
}
interface getFileListApiResponse {
  name: string;
  id: string;
  type: string;
  parent: string;
}

export default function DataSource({ opened, onClose }: Props) {
  const title = "Data Source"
  const [file, setFile] = useState<File | null>();
  const [fileList, setFileList] = useState([]);
  const [isFile, setIsFile] = useState<boolean>(true);
  const [deleteSpinner, setDeleteSpinner] = useState<boolean>(false);
  const [url, setURL] = useState<string>("");
  const dispatch = useAppDispatch();
  const fileDataSources = useAppSelector(fileDataSourcesSelector);

  const getFileList = async () => {

    try {
      setTimeout(async () => {
        const response = await client.post(
          `${DATA_PREP_URL}/get_file`,
          {}, // Request body (if needed, replace the empty object with actual data)
          {
            headers: {
              'Content-Type': 'application/json',
            },
          });

          setFileList(response.data);
      }, 1500);
    }
    catch (error) {
      console.error("Error fetching file data:", error);
    }
  };

  const deleteFile = async (id: string) => {
    try {
      await client.post(
        `${DATA_PREP_URL}/delete_file`,
        { file_path: id }, // Request body (if needed, replace the empty object with actual data)
        {
          headers: {
            'Content-Type': 'application/json',
          },
        });

      getFileList();
    }
    catch (error) {
      console.error("Error fetching file data:", error);
    }
    setDeleteSpinner(false);
  }
  
  const handleFileUpload = () => {
    if (file){
      const id = uuidv4();
      dispatch(addFileDataSource({ id, source: [file.name], type: 'Files', startTime: getCurrentTimeStamp() }));
      dispatch(updateFileDataSourceStatus({ id, status: 'uploading' }));
      dispatch(uploadFile({ file }))
      .then((response) => {
        // Handle successful upload
        if (response.payload &&  response.payload.status === 200) {
          console.log("Upload successful:", response);
          getFileList();
          dispatch(updateFileDataSourceStatus({ id, status: 'uploaded' }));
        }
        else {
          console.error("Upload failed:", response);
          getFileList();
          dispatch(updateFileDataSourceStatus({ id, status: 'failed' }));
        }
      })
      .catch((error) => {
        // Handle failed upload
        console.error("Upload failed:", error);
        getFileList();
        dispatch(updateFileDataSourceStatus({ id, status: 'failed' }));
      });
    };
    getFileList();
  }

  const handleChange = (event: SyntheticEvent) => {
    event.preventDefault()
    setURL((event.target as HTMLTextAreaElement).value)
  }

  const handleSubmit = () => {
    const id = uuidv4();
    dispatch(addFileDataSource({ id, source: url.split(";"), type: 'URLs', startTime: getCurrentTimeStamp() }));
    dispatch(updateFileDataSourceStatus({ id, status: 'uploading' }));
    dispatch(submitDataSourceURL({ link_list: url.split(";") }))
    .then((response) => {
      // Handle successful upload
      if (response.payload &&  response.payload.status === 200) {
        console.log("Upload successful:", response);
        getFileList();

        dispatch(updateFileDataSourceStatus({ id, status: 'uploaded' }));
      }
      else {
        console.error("Upload failed:", response);
        getFileList();

        dispatch(updateFileDataSourceStatus({ id, status: 'failed' }));
      }
    })
    .catch((error) => {
      // Handle failed upload
      console.error("Upload failed:", error);
      getFileList();
      dispatch(updateFileDataSourceStatus({ id, status: 'failed' }));
    });
  }

  useEffect(() => {
    let isFetching = false; // Flag to track if the function is in progress
  
    const interval = setInterval(async () => {
      if (!isFetching) {
        isFetching = true;
        await getFileList(); // Wait for the function to complete
        isFetching = false;
      }
    }, 20000); // 2000 ms = 2 seconds
  
    // Clear the interval when the component unmounts
    return () => clearInterval(interval);
  }, []);


  return (
    <Drawer position="right" opened={opened} onClose={onClose} withOverlay={false}>
      <Text
        size="xl"
        fw={900}
        variant="gradient"
        gradient={{ from: 'blue', to: 'cyan', deg: 90 }}
      >
        {title}
      </Text>
      <Text size="sm">
        Please upload your local file or paste a remote file link, and Chat will respond based on the content of the uploaded file.
      </Text>


      <Container styles={{
        root: { paddingTop: '40px', display:'flex', flexDirection:'column', alignItems:'center' }
      }}>
        <Button.Group styles={{ group:{alignSelf:'center'}}} >
          <Button variant={isFile ? 'filled' : 'default'} onClick={() => setIsFile(true)}>Upload FIle</Button>
          <Button variant={!isFile ? 'filled' : 'default'} onClick={() => setIsFile(false)}>Use Link</Button>
        </Button.Group>
      </Container>

      <Container styles={{root:{paddingTop: '40px'}}}>
        <div>
          {isFile ? (
            <>
              <FileInput value={file} onChange={setFile} placeholder="Choose File" description={"choose a file to upload for RAG"}/>
              <Button style={{marginTop:'5px'}} onClick={handleFileUpload} disabled={!file}>Upload</Button>
            </>
          ) : (
            <>
              <TextInput value={url} onChange={handleChange} placeholder='URL' description={"Use semicolons (;) to separate multiple URLs."} />
                <Button style={{ marginTop: '5px' }} onClick={handleSubmit} disabled={!url}>Upload</Button>
            </>
          )}
        </div>
      </Container>
      <Container styles={{ root: { paddingTop: '40px' } }}>
      <Text
        size="xl"
        fw={900}
        variant="gradient"
        gradient={{ from: 'blue', to: 'cyan', deg: 90 }}
        style={{ marginBottom: '10px' }}
      >
        Upload Job Queue
      </Text>
        <Table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
          <tr style={{ borderBottom: '1px solid black' }}>
              <th style={{ textAlign: 'center' }}>ID</th>
              <th style={{ textAlign: 'center' }}>Type</th>
              <th style={{ textAlign: 'center' }}>Start Time</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {fileDataSources.map((item: FileDataSource, index:number) => (
              <tr key={item.id}>
                <td style={{ textAlign: 'center' }}>{index+1}</td>
                <td style={{ textAlign: 'center' }}>{item.type}</td>
                <td style={{ textAlign: 'center' }}>
                  {new Date(item.startTime*1000).toLocaleString('en-GB', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </td>
                <td style={{ textAlign: 'center' }}>{
                  item.status === 'pending' ? 
                    (<Loader size={30} />) : item.status === 'uploading' ?
                      (<Loader size={30} />) : item.status === 'uploaded' ?
                        (
                          <ActionIcon color="teal" variant="light" radius="sm" size="sm">
                            <IconCheck style={{ width: rem(22), height: rem(22) }} />
                          </ActionIcon>
                      ) : (
                          <IconExclamationCircle size={30} color="red" stroke={2} />
                    )
                    
                    }</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Button 
          onClick={() => dispatch(clearFileDataSources())} 
          color="red" 
          disabled={fileDataSources.length === 0 || fileDataSources.some((item: FileDataSource) => item.status === 'uploading')} 
          style={{ marginBottom: '10px' } }>
          Clear Job Queue
        </Button>
      </Container>
      <Container styles={{ root: { paddingTop: '40px' } }}>
      <Text
        size="xl"
        fw={900}
        variant="gradient"
        gradient={{ from: 'blue', to: 'cyan', deg: 90 }}
        style={{ marginBottom: '10px' }}
      >
        Uploaded Data Sources
      </Text>
        <Table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
          <tr style={{ borderBottom: '1px solid black' }}>
              <th style={{ textAlign: 'center', width: '12%' }}>ID</th>
              <th style={{ textAlign: 'left', width: '70%' }}>Source Name</th>
              <th style={{ textAlign: 'center', width: '18%' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {fileList.map((item: getFileListApiResponse, index:number) => (
              <tr key={item.id}>
                <td style={{ textAlign: 'center' }}>{index+1}</td>
                <td style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.id.length > 40 ? item.id.slice(0, 36) + '...' : item.id}
                </td>
                <td style={{ textAlign: 'center' }}> 
                  <Button 
                    color='red' 
                    styles={{ root: { paddingLeft: '2px', paddingRight: '2px' } }} 
                    onClick={() => {
                      deleteFile(item.id)
                      setDeleteSpinner(true)
                      }}
                      disabled={deleteSpinner} 
                      >
                    {deleteSpinner? (<Loader size={30} />) : <IconFileXFilled style={{ width: rem(22), height: rem(22) }} />}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Container>
    </Drawer>
  )
}